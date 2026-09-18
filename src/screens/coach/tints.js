// src/screens/coach/tints.js
// Цвета-акценты для разных ИИ-карточек раздела «Тренер» — чтобы визуально
// различались между собой. Базово: синий / бирюза / янтарь. Если выбранный
// пользователем акцент совпадает с одним из них — подменяем на фиолетовый,
// чтобы карточка не сливалась с интерфейсом.

const BLUE = '#3B82F6';
const TEAL = '#14B8A6';
const AMBER = '#F59E0B';
const VIOLET = '#8B5CF6';

export function coachTints(accentId) {
  return {
    workout: accentId === 'blue' ? VIOLET : BLUE,
    supp: accentId === 'teal' ? VIOLET : TEAL,
    reco: accentId === 'amber' ? VIOLET : AMBER,
  };
}
