<template>
  <g class="pixel-mark pixel-cherry-mark">
    <rect class="pixel-stem" x="28" y="6" width="4" height="6" />
    <rect class="pixel-stem" x="24" y="12" width="4" height="6" />
    <rect class="pixel-leaf-dark" x="14" y="10" width="14" height="6" />
    <rect class="pixel-leaf-mid" x="10" y="16" width="14" height="6" />
    <rect class="pixel-leaf" x="14" y="22" width="8" height="4" />
    <rect class="pixel-cherry-dark" x="18" y="20" width="14" height="22" />
    <rect class="pixel-cherry-dark" x="14" y="24" width="22" height="16" />
    <rect class="pixel-cherry-dark" x="12" y="30" width="26" height="8" />
    <rect class="pixel-cherry-mid" x="16" y="26" width="18" height="14" />
    <rect class="pixel-cherry-mid" x="14" y="30" width="22" height="6" />
    <rect class="pixel-cherry" x="20" y="26" width="10" height="12" />
    <rect class="pixel-cherry" x="18" y="30" width="14" height="6" />
    <rect class="pixel-shine" x="18" y="28" width="6" height="6" />
    <rect class="pixel-shadow" x="20" y="40" width="12" height="4" />
  </g>
</template>


<style scoped lang="less">
.pixel-mark {
  shape-rendering: crispEdges;
}

.pixel-frame,
.pixel-core,
.pixel-soft,
.pixel-stem,
.pixel-leaf,
.pixel-leaf-mid,
.pixel-leaf-dark,
.pixel-cherry,
.pixel-cherry-mid,
.pixel-cherry-dark,
.pixel-shine,
.pixel-shadow {
  stroke: none;
}

.pixel-stem {
  fill: var(--leaf);
}

.pixel-leaf {
  fill: var(--leaf);
}

.pixel-leaf-mid {
  fill: var(--leaf-mid);
}

.pixel-leaf-dark {
  fill: var(--leaf-deep);
}

.pixel-cherry {
  fill: var(--cherry);
}

.pixel-cherry-mid {
  fill: var(--cherry-mid);
}

.pixel-cherry-dark {
  fill: var(--cherry-deep);
}

.pixel-shine {
  fill: var(--cherry-shine);
}

.pixel-shadow {
  fill: rgba(60, 8, 24, 0.72);
}
</style>
