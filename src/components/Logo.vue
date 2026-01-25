<template>
  <img src="/avatar.jpg" alt="Avatar" class="avatar">
</template>

<style scoped>
.avatar {
  width: 100%;
  height: auto;
  max-width: 100px;
  border-radius: 50%;
}

@media (prefers-reduced-motion) {
  .avatar {
    animation: none !important;
  }
}

@media print {
  .avatar {
    animation: none !important;
  }
}

.avatar {
  transform-origin: center;
}
</style>
