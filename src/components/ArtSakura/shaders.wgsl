struct Uniforms {
  viewportSize : vec2f,
}

struct Particle {
  position : vec2f,
  size : vec2f,
  velocity : vec2f,
  rotation : f32,
  angularVelocity : f32,
  distance : f32,
  opacity : f32,
  colorVariant : f32,
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
  @location(3) colorVariant : f32,
  @location(4) rotation : f32,
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
  let rot = particle.rotation;
  let cosR = cos(rot);
  let sinR = sin(rot);
  let rotatedPos = vec2f(
    vertexPos.x * cosR - vertexPos.y * sinR,
    vertexPos.x * sinR + vertexPos.y * cosR
  );

  let pos = (particlePosNorm + particleSizeNorm * rotatedPos) * 2.0 - 1.0;

  var out : QuadVertexOutput;
  out.position = vec4f(pos.x, -pos.y, 0.0, 1.0);
  out.uv = vertexPos * 2.0;
  out.distance = particle.distance;
  out.opacity = particle.opacity;
  out.colorVariant = particle.colorVariant;
  out.rotation = rot;
  return out;
}

fn sdPetal(p : vec2f) -> f32 {
  let aspect = 0.6;
  let px = p.x;
  let py = p.y * aspect;

  let d = length(vec2f(px, py)) - 0.35;

  let notchDepth = 0.12;
  let notchWidth = 0.15;
  let notch = max(abs(px) - notchWidth, py - 0.15);

  let tipNotch = py - 0.25 + abs(px) * 0.8;

  return max(d, -max(notch, tipNotch));
}

fn sdSakura(p : vec2f, rotation : f32) -> f32 {
  let angle = atan2(p.y, p.x) - rotation;
  let radius = length(p);

  let sector = mod(angle + PI, TWO_PI / 5.0) - PI / 5.0;

  let localX = radius * cos(sector);
  let localY = radius * sin(sector);

  let petalDist = sdPetal(vec2f(localX, localY));

  let centerDist = radius - 0.08;

  return min(petalDist, centerDist);
}

const PI : f32 = 3.14159265;
const TWO_PI : f32 = 6.2831853;

@fragment
fn particleFragment(in : QuadVertexOutput) -> @location(0) vec4f {
  if (in.position.x > uniforms.viewportSize.x ||
      in.position.y > uniforms.viewportSize.y) {
    discard;
  }

  let sakuraDist = sdSakura(in.uv.xy, 0.0);
  let edgeSoftness = 0.06 / in.distance;
  let alpha = 1.0 - smoothstep(-edgeSoftness, edgeSoftness * 1.5, sakuraDist);

  if (alpha < 0.01) {
    discard;
  }

  let variant = in.colorVariant;

  let pinkLight = vec3f(1.0, 0.85, 0.90);
  let pinkMedium = vec3f(1.0, 0.72, 0.80);
  let pinkDark = vec3f(0.95, 0.60, 0.72);
  let white = vec3f(1.0, 0.98, 1.0);

  var baseColor : vec3f;
  if (variant < 0.25) {
    baseColor = mix(white, pinkLight, variant * 4.0);
  } else if (variant < 0.5) {
    baseColor = mix(pinkLight, pinkMedium, (variant - 0.25) * 4.0);
  } else if (variant < 0.75) {
    baseColor = mix(pinkMedium, pinkDark, (variant - 0.5) * 4.0);
  } else {
    baseColor = mix(pinkDark, pinkMedium, (variant - 0.75) * 4.0);
  }

  let gradientFactor = (in.uv.y + 1.0) * 0.5;
  let color = mix(baseColor * 0.85, baseColor * 1.1, gradientFactor);

  let brightness = alpha * in.opacity;
  return vec4f(color * brightness, brightness);
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
  let time = simulationCtx.time;
  let wind = sin(time / 4000.0) * 0.0003;

  var particle = writableParticles[globalInvocationId.x];
  if (particle.spawned == 0 || particle.position.y > uniforms.viewportSize.y) {
    if (atomicSub(&simulationCtx.particlesToSpawn, 1) > 0) {
      particle.position.x = rand() * uniforms.viewportSize.x;
      particle.position.y = -50.0;

      let nearCamera = rand() > 0.92;
      let baseDistance = select(5.0, 1.0, nearCamera);
      let distanceVariation = select(2.5, 0.8, nearCamera);
      let distance = baseDistance + rand() * distanceVariation;
      particle.distance = distance;

      let largePetal = rand() > 0.88;
      let baseSize = select(6.0, 12.0, largePetal);
      let sizeVariation = select(3.0, 5.0, largePetal);
      let distanceFactor = (distance / 6.0) * 0.15 + 1.0;
      particle.size = vec2f(baseSize + rand() * sizeVariation) * distanceFactor;

      let vyVariation = select(0.8, 1.2, largePetal);
      particle.velocity = vec2f(-0.5 + rand() * 1.0, rand() * vyVariation);

      particle.rotation = rand() * TWO_PI;
      particle.angularVelocity = (rand() - 0.5) * 0.003;

      let baseOpacity = select(0.5, 0.85, nearCamera);
      particle.opacity = baseOpacity - distance / 12.0;

      particle.colorVariant = rand();

      particle.spawned = 1;
    }
  }

  let swayFreq = 0.001 + particle.distance * 0.0002;
  let swayAmp = 0.5 + particle.distance * 0.1;
  let sway = sin(time * swayFreq + particle.position.x * 0.01) * swayAmp;

  particle.velocity.x += (wind + sway * 0.0001) * timeDelta;
  particle.velocity.y += 0.02 * timeDelta;

  particle.rotation += particle.angularVelocity * timeDelta;

  particle.position += particle.velocity * timeDelta;

  writableParticles[globalInvocationId.x] = particle;
}
