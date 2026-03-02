<script setup lang="ts">
/**
 * PlacardRenderer — hidden off-screen component used as an html2canvas render target.
 *
 * Renders an A4-landscape placard using the TOP half only (the card will be folded
 * to create a table-tent). Layout:
 *   - Center: dish name (large) + country flag & name below
 *   - Bottom edge: group member names (horizontal)
 *   - Right column: dietary-flag icons (vertical)
 *   - Left column (mirror): ISA logo
 *
 * All styles are inlined / scoped so html2canvas captures them correctly.
 */
import { computed } from 'vue'
import { DIETARY_FLAGS } from '@/data/dietaryFlags'
import { COUNTRIES, flagEmoji } from '@/data/countries'
import type { SubmissionResponse } from '@/api/submissions'
import type { IngredientDietary } from '@/types/ingredient'

const props = defineProps<{
  submission: SubmissionResponse
  effectiveDietary?: IngredientDietary | null
}>()

/** Aggregate dietary from ingredients when effectiveDietary not provided */
function aggregateDietaryFromSubmission(sub: SubmissionResponse): IngredientDietary {
  const keys = [
    'is_alcohol', 'gluten', 'dairy', 'egg', 'peanut',
    'kosher', 'vegan', 'vegetarian', 'lactose_free', 'wheat_free',
  ] as const
  const out = {} as IngredientDietary
  for (const k of keys) {
    out[k] = sub.ingredients.some((i) => i.ingredient.dietary?.[k])
  }
  return out
}

const dietary = computed<IngredientDietary>(() => {
  if (props.effectiveDietary != null) return props.effectiveDietary
  return aggregateDietaryFromSubmission(props.submission)
})

const activeFlags = computed(() => DIETARY_FLAGS.filter(({ key }) => dietary.value[key]))

const countryName = computed(() => {
  if (!props.submission.country_code) return ''
  const c = COUNTRIES.find((x) => x.code === props.submission.country_code)
  return c ? c.name : ''
})

const flag = computed(() =>
  props.submission.country_code ? flagEmoji(props.submission.country_code) : '',
)
</script>

<template>
  <!--
    Full A4 landscape page: 297 mm × 210 mm.
    Only the TOP half (297 × 105 mm) is the visible placard face;
    the bottom half is left blank (back of the fold).
  -->
  <div class="placard-page">
    <!-- Top half intentionally blank (fold back) -->
    <div class="placard-fold-back"></div>

    <!-- Fold line divider -->
    <div class="placard-fold-line"></div>

    <div class="placard-face">
      <!-- Left column — ISA logo (mirrors dietary icons on right) -->
      <div class="placard-col-left">
        <img src="/isa-logo.png" alt="ISA" class="placard-logo" crossorigin="anonymous" />
      </div>

      <!-- Center content -->
      <div class="placard-center">
        <div class="placard-dish">{{ submission.dish_name }}</div>
        <div v-if="flag || countryName" class="placard-country">
          <span v-if="flag" class="placard-flag">{{ flag }}</span>
          <span v-if="countryName">{{ countryName }}</span>
        </div>
      </div>

      <!-- Right column — dietary icons stacked vertically with labels -->
      <div class="placard-col-right">
        <span
          v-for="{ key, label, icon } in activeFlags"
          :key="key"
          class="placard-dietary-icon"
          :title="label"
        >
          <component :is="icon" :size="22" aria-hidden="true" />
          <span class="placard-dietary-label">{{ label }}</span>
        </span>
      </div>

      <!-- Bottom strip — group members -->
      <div class="placard-members">
        <span
          v-for="(m, i) in submission.members"
          :key="i"
          class="placard-member"
        >{{ m }}<span v-if="i < submission.members.length - 1" class="placard-member-sep">&ensp;·&ensp;</span></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---- A4 landscape page ---- */
.placard-page {
  width: 297mm;
  height: 210mm;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  font-family: 'Roboto Mono', 'Courier New', monospace;
  color: #1a1a1a;
  overflow: hidden;
}

/* Top half — blank fold back */
.placard-fold-back {
  width: 100%;
  height: 105mm;
  flex: none;
}

/* Fold line between halves */
.placard-fold-line {
  width: 100%;
  height: 0;
  border-top: 0.3mm dashed #ccc;
  flex: none;
}

/* Bottom half — visible placard face */
.placard-face {
  width: 100%;
  height: 105mm;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 12mm 16mm 14mm;
}

/* ---- Left column: ISA logo ---- */
.placard-col-left {
  position: absolute;
  left: 14mm;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.placard-logo {
  width: 28mm;
  height: auto;
  object-fit: contain;
}

/* ---- Center content ---- */
.placard-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 200mm;
  gap: 3mm;
}

.placard-dish {
  font-size: 40pt;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.02em;
  word-break: break-word;
}

.placard-country {
  font-size: 16pt;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 3mm;
  opacity: 0.85;
}

.placard-flag {
  font-size: 22pt;
}

/* ---- Right column: dietary icons ---- */
.placard-col-right {
  position: absolute;
  right: 14mm;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2mm;
}

.placard-dietary-icon {
  display: flex;
  align-items: center;
  gap: 1.5mm;
  color: var(--color-lafayette-gray, #3c373c);
}

.placard-dietary-icon svg {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
}

.placard-dietary-label {
  font-size: 6.5pt;
  white-space: nowrap;
  opacity: 0.7;
}

/* ---- Bottom members strip ---- */
.placard-members {
  position: absolute;
  bottom: 5mm;
  left: 14mm;
  right: 14mm;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0;
  font-size: 10pt;
  opacity: 0.75;
}

.placard-member {
  white-space: nowrap;
}

.placard-member-sep {
  opacity: 0.5;
}
</style>
