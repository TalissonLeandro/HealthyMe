/* ============================================================
   STORAGE.JS — Funções de armazenamento no localStorage
   Bem-Estar App | ODS 3
   ============================================================ */

const KEYS = {
  profile:       'bemEstar_profile',
  water:         'bemEstar_waterRecords',
  activity:      'bemEstar_activityRecords',
  sleep:         'bemEstar_sleepRecords',
  goals:         'bemEstar_goals',
  goalHistory:   'bemEstar_goalHistory',
  points:        'bemEstar_points',
  quizProgress:  'bemEstar_quizProgress',
};

/* ---- Generic helpers ---- */

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Erro ao salvar dados:', e);
  }
}

function loadData(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    return fallback;
  }
}

/* ---- Date utilities ---- */

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function dayNameShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return names[date.getDay()];
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=Sunday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

/* ---- Profile ---- */

function getProfile() {
  return loadData(KEYS.profile, {
    name: '',
    waterGoal: 2000,
    activityGoalWeekly: 150,
    sleepGoal: 8,
  });
}

function saveProfileData(data) {
  saveData(KEYS.profile, data);
}

/* ---- Water Records ---- */
// Structure: { [dateStr]: [ {id, amount, time}, ... ] }

function getWaterRecords() {
  return loadData(KEYS.water, {});
}

function getTodayWater() {
  const records = getWaterRecords();
  return records[todayStr()] || [];
}

function getTodayWaterTotal() {
  return getTodayWater().reduce((sum, r) => sum + r.amount, 0);
}

function addWaterRecord(amount) {
  const records = getWaterRecords();
  const day = todayStr();
  if (!records[day]) records[day] = [];
  records[day].push({
    id: Date.now(),
    amount: amount,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  });
  saveData(KEYS.water, records);
}

function removeLastWaterRecord() {
  const records = getWaterRecords();
  const day = todayStr();
  if (records[day] && records[day].length > 0) {
    records[day].pop();
    saveData(KEYS.water, records);
    return true;
  }
  return false;
}

function removeWaterRecord(id) {
  const records = getWaterRecords();
  const day = todayStr();
  if (records[day]) {
    records[day] = records[day].filter(r => r.id !== id);
    saveData(KEYS.water, records);
  }
}

function getWaterForDate(dateStr) {
  const records = getWaterRecords();
  const list = records[dateStr] || [];
  return list.reduce((sum, r) => sum + r.amount, 0);
}

/* ---- Activity Records ---- */
// Structure: [ {id, type, duration, date}, ... ]

function getActivityRecords() {
  return loadData(KEYS.activity, []);
}

function saveActivityRecord(record) {
  const records = getActivityRecords();
  records.push({ ...record, id: Date.now() });
  saveData(KEYS.activity, records);
}

function removeActivityRecord(id) {
  const records = getActivityRecords().filter(r => r.id !== id);
  saveData(KEYS.activity, records);
}

function getActivityForDate(dateStr) {
  return getActivityRecords().filter(r => r.date === dateStr);
}

function getActivityMinutesForDate(dateStr) {
  return getActivityForDate(dateStr).reduce((sum, r) => sum + Number(r.duration), 0);
}

function getWeekActivityRecords() {
  const weekStart = getWeekStart();
  return getActivityRecords().filter(r => r.date >= weekStart);
}

/* ---- Sleep Records ---- */
// Structure: [ {id, date, sleepTime, wakeTime, durationMinutes}, ... ]

function getSleepRecords() {
  return loadData(KEYS.sleep, []);
}

function saveSleepRecord(record) {
  const records = getSleepRecords();
  // Remove existing record for the same date to avoid duplicates
  const filtered = records.filter(r => r.date !== record.date);
  filtered.push({ ...record, id: Date.now() });
  // Sort by date desc
  filtered.sort((a, b) => (b.date > a.date ? 1 : -1));
  saveData(KEYS.sleep, filtered);
}

function removeSleepRecord(id) {
  const records = getSleepRecords().filter(r => r.id !== id);
  saveData(KEYS.sleep, records);
}

function getSleepForDate(dateStr) {
  return getSleepRecords().find(r => r.date === dateStr) || null;
}

function getLastSleep() {
  const records = getSleepRecords();
  return records.length > 0 ? records[0] : null;
}

function calcSleepDuration(sleepTime, wakeTime) {
  // Returns duration in minutes. Handles overnight sleep.
  const [sh, sm] = sleepTime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let sleepMins = sh * 60 + sm;
  let wakeMins  = wh * 60 + wm;
  if (wakeMins <= sleepMins) wakeMins += 24 * 60; // crossed midnight
  return wakeMins - sleepMins;
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}min`;
}

/* ---- Goals ---- */
// Structure: [ {id, text, freq, createdAt} ]
// Goal history: { [dateStr]: { [goalId]: true/false } }

function getGoals() {
  return loadData(KEYS.goals, []);
}

function saveGoals(goals) {
  saveData(KEYS.goals, goals);
}

function addGoal(text, freq) {
  const goals = getGoals();
  goals.push({ id: Date.now(), text, freq, createdAt: todayStr() });
  saveData(KEYS.goals, goals);
}

function removeGoal(id) {
  const goals = getGoals().filter(g => g.id !== id);
  saveData(KEYS.goals, goals);
}

function updateGoalText(id, newText) {
  const goals = getGoals().map(g => g.id === id ? { ...g, text: newText } : g);
  saveData(KEYS.goals, goals);
}

function getGoalHistory() {
  return loadData(KEYS.goalHistory, {});
}

function toggleGoalCompletion(goalId) {
  const history = getGoalHistory();
  const day = todayStr();
  if (!history[day]) history[day] = {};
  history[day][goalId] = !history[day][goalId];
  saveData(KEYS.goalHistory, history);
  return history[day][goalId];
}

function isGoalCompletedToday(goalId) {
  const history = getGoalHistory();
  const day = todayStr();
  return !!(history[day] && history[day][goalId]);
}

function getDailyGoalStats(dateStr) {
  const goals = getGoals().filter(g => g.freq === 'daily');
  const history = getGoalHistory();
  const dayHist = history[dateStr] || {};
  const completed = goals.filter(g => !!dayHist[g.id]).length;
  return { total: goals.length, completed };
}

/* ---- Points ---- */

function getPoints() {
  return loadData(KEYS.points, 0);
}

function addPoints(amount) {
  const current = getPoints();
  saveData(KEYS.points, current + amount);
  return current + amount;
}

function getLevelInfo(points) {
  const levels = [
    { name: 'Iniciante',   icon: '🌱', min: 0,   max: 99  },
    { name: 'Saudável',    icon: '🌿', min: 100,  max: 299 },
    { name: 'Bem-Estar',   icon: '🌳', min: 300,  max: 599 },
    { name: 'Inspirador',  icon: '⭐', min: 600,  max: Infinity },
  ];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (points >= levels[i].min) {
      const level = levels[i];
      const progress = i < levels.length - 1
        ? ((points - level.min) / (level.max + 1 - level.min)) * 100
        : 100;
      const nextLevel = i < levels.length - 1 ? levels[i + 1] : null;
      return { ...level, progress, nextLevel, index: i };
    }
  }
  return levels[0];
}

/* ---- Quiz Progress ---- */

function getQuizProgress() {
  return loadData(KEYS.quizProgress, { currentIndex: 0, score: 0, answered: [] });
}

function saveQuizProgress(data) {
  saveData(KEYS.quizProgress, data);
}

function resetQuizProgress() {
  saveData(KEYS.quizProgress, { currentIndex: 0, score: 0, answered: [] });
}

/* ---- Clear All Data ---- */

function clearAllData() {
  Object.values(KEYS).forEach(key => localStorage.removeItem(key));
}
