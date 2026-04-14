struct Uniforms {
  viewportSize : vec2f,
}

struct Particle {
  position : vec2f,
  size : vec2f,
  velocity : vec2f,
  distance : f32,
  opacity : f32,
  spawned : i32,
}

struct SimulationContext {
  time : f32,
  timeDelta : f32,
  randSeed : f32,
  particlesToSpawn : atomic<i32>,
}

@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<storage, read> particles : array<Particle>;

struct QuadVertexInput {
  @builtin(instance_index) particleIndex : u32,
  @builtin(vertex_index) vertexIndex : u32,
}

struct QuadVertexOutput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
  @location(1) distance : f32,
  @location(2) opacity : f32,
}

@vertex
fn particleVertex(in : QuadVertexInput) -> QuadVertexOutput {
  const vertices = array<vec2f, 4>(
    vec2(-0.5, -0.5),
    vec2(0.5, -0.5),
    vec2(-0.5, 0.5),
    vec2(0.5, 0.5)
  );

  let particle = &particles[in.particleIndex];
  let particlePosNorm = particle.position / uniforms.viewportSize;
  let particleSizeNorm = particle.size / uniforms.viewportSize;

  let vertexPos = vertices[in.vertexIndex];
  let pos = (particlePosNorm + particleSizeNorm * vertexPos) * 2.0 - 1.0;

  var out : QuadVertexOutput;
  out.position = vec4f(pos.x, -pos.y, 0.0, 1.0);
  out.uv = vertexPos * 2.0;
  out.distance = particle.distance;
  out.opacity = particle.opacity;
  return out;
}

fn sdSnowflake(p : vec2f) -> f32 {
  let angle = atan2(p.y, p.x);
  let radius = length(p);

  let sector = abs(((angle + 3.14159265) % 1.0471975) - 0.5235988);

  let armWidth = 0.1;
  let armLength = 0.4;

  let localX = radius * cos(sector);
  let localY = radius * sin(sector);

  let mainArm = abs(localY) - armWidth * (1.0 - localX * 0.5);

  let branchPos1 = 0.2;
  let branchAngle = 0.5;

  let b1x = localX - branchPos1;
  let b1Arm = abs(localY - b1x * branchAngle) - armWidth * 0.5;

  let inArm = select(1.0, mainArm, localX > 0.0 && localX < armLength);
  let inBranch1 = select(1.0, b1Arm, b1x > 0.0 && b1x < 0.12);

  let centerHex = radius - 0.1;

  return min(min(inArm, inBranch1), centerHex);
}

@fragment
fn particleFragment(in : QuadVertexOutput) -> @location(0) vec4f {
  if (in.position.x > uniforms.viewportSize.x ||
      in.position.y > uniforms.viewportSize.y) {
    discard;
  }

  let snowDist = sdSnowflake(in.uv.xy);
  let edgeSoftness = 0.08 / in.distance;
  let alpha = 1.0 - smoothstep(-edgeSoftness, edgeSoftness * 2.0, snowDist);

  let brightness = alpha * in.opacity;
  return vec4f(brightness);
}

struct Pcg32RandomState {
  state : u32,
}

var<private> randState : Pcg32RandomState;

fn initRand(invocationId : u32, seed : f32) {
  randState.state = invocationId * 1664525u + u32(seed * 1664525.0);
}

fn rand() -> f32 {
  let state = randState.state * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  randState.state = (word >> 22u) ^ word;
  return f32(randState.state) / 4294967296.0;
}

@binding(1) @group(0) var<storage, read_write> writableParticles : array<Particle>;
@binding(2) @group(0) var<storage, read_write> simulationCtx : SimulationContext;

@compute @workgroup_size(64)
fn updateParticles(@builtin(global_invocation_id) globalInvocationId : vec3u) {
  initRand(globalInvocationId.x, simulationCtx.randSeed);

  let timeDelta = simulationCtx.timeDelta / 10.0;
  let wind = sin(simulationCtx.time / 5000.0) * 0.0002;

  var particle = writableParticles[globalInvocationId.x];
  if (particle.spawned == 0 || particle.position.y > uniforms.viewportSize.y) {
    if (atomicSub(&simulationCtx.particlesToSpawn, 1) > 0) {
      particle.position.x = rand() * uniforms.viewportSize.x;
      particle.position.y = -100.0;

      let nearCamera = rand() > 0.95;
      let baseDistance = select(6.0, 1.0, nearCamera);
      let distanceVariation = select(3.0, 1.0, nearCamera);
      let distance = baseDistance + rand() * distanceVariation;
      particle.distance = distance;

      let largeFlake = rand() > 0.92;

      let baseSize = select(4.0, 8.0, largeFlake);
      let sizeVariation = select(2.5, 4.0, largeFlake);
      let distanceFactor = (distance / 9.0) * 0.1 + 1.0;
      particle.size = vec2f(baseSize + rand() * sizeVariation) * distanceFactor;

      let vyVariation = select(1.5, particle.size.y, largeFlake);
      particle.velocity = vec2f(-1.0 + rand() * 2.0, rand() * vyVariation);

      let baseOpacity = select(0.6, 0.9, nearCamera);
      particle.opacity = baseOpacity - distance / 14.0;
      particle.spawned = 1;
    }
  }
  particle.velocity.x += wind * timeDelta;
  particle.velocity.y += 0.025 * timeDelta;
  particle.position += particle.velocity * timeDelta;
  writableParticles[globalInvocationId.x] = particle;
}
