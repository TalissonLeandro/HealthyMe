/* ============================================================
   APP.JS — Lógica principal do HealthyMe
   ODS 3 — Saúde e Bem-Estar
   Todas as funções de UI, navegação e integração com storage
   ============================================================ */

'use strict';

/* ============================================================
   NAVEGAÇÃO ENTRE PÁGINAS
   ============================================================ */

let currentPage = 'dashboard';

function navigateTo(page) {
  // Oculta todas as páginas
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Exibe a página alvo
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // Atualiza nav lateral
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Atualiza nav inferior
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  currentPage = page;

  // Recarrega dados da página ao navegar para ela
  switch (page) {
    case 'dashboard':  renderDashboard();   break;
    case 'hydration':  renderHydration();   break;
    case 'activity':   renderActivity();    break;
    case 'sleep':      renderSleep();       break;
    case 'goals':      renderGoals();       break;
    case 'progress':   renderProgress();    break;
    case 'content':    renderContent();     break;
    case 'profile':    renderProfile();     break;
  }

  // Scroll para o topo (mobile usa window, desktop usa mainContent)
  window.scrollTo(0, 0);
  const mc = document.getElementById('mainContent');
  if (mc) mc.scrollTop = 0;
}

function initNavigation() {
  // Sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  // Bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  // Cards clicáveis do dashboard
  document.querySelectorAll('.summary-card[data-page]').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.page));
  });
}

/* ============================================================
   UTILITÁRIOS DE UI
   ============================================================ */

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(100, Math.max(0, pct)) + '%';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function fmtMl(ml) {
  return ml >= 1000
    ? (ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1).replace('.', ',') + ' L'
    : ml + ' ml';
}

function fmtMlFull(ml) {
  return Number(ml).toLocaleString('pt-BR') + ' ml';
}

let toastTimer = null;
function showToast(msg, duration = 2800) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function renderDashboard() {
  const profile = getProfile();
  const today   = todayStr();

  // Saudação
  const name = profile.name ? profile.name.split(' ')[0] : null;
  const hour = new Date().getHours();
  let greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  setText('greetingText', name ? `${greeting}, ${name}! 👋` : `${greeting}! 👋`);

  // Água
  const waterTotal = getTodayWaterTotal();
  const waterGoal  = profile.waterGoal || 2000;
  const waterPct   = Math.min(100, (waterTotal / waterGoal) * 100);
  setText('dashWater', fmtMl(waterTotal));
  setText('dashWaterGoal', 'Meta: ' + fmtMlFull(waterGoal));
  setBar('dashWaterBar', waterPct);

  // Atividade (hoje)
  const actMins = getActivityMinutesForDate(today);
  const weekGoal = profile.activityGoalWeekly || 150;
  const weekMins = getWeekActivityRecords().reduce((s, r) => s + Number(r.duration), 0);
  const actPct   = Math.min(100, (weekMins / weekGoal) * 100);
  setText('dashActivity', actMins + ' min');
  setText('dashActivitySub', 'hoje · ' + weekMins + ' min/semana');
  setBar('dashActivityBar', actPct);

  // Sono
  const lastSleep  = getLastSleep();
  const sleepGoal  = (profile.sleepGoal || 8) * 60;
  if (lastSleep) {
    const dur = lastSleep.durationMinutes;
    setText('dashSleep', formatDuration(dur));
    setText('dashSleepSub', 'em ' + formatDateLabel(lastSleep.date));
    setBar('dashSleepBar', Math.min(100, (dur / sleepGoal) * 100));
  } else {
    setText('dashSleep', '--');
    setText('dashSleepSub', 'última noite');
    setBar('dashSleepBar', 0);
  }

  // Metas
  const goalStats = getDailyGoalStats(today);
  setText('dashGoals', goalStats.total === 0 ? '0/0' : `${goalStats.completed}/${goalStats.total}`);
  const goalPct = goalStats.total > 0 ? (goalStats.completed / goalStats.total) * 100 : 0;
  setBar('dashGoalsBar', goalPct);

  // Pontos
  const pts   = getPoints();
  const level = getLevelInfo(pts);
  setText('pointsDisplay', pts + ' pts');
  setText('dashTotalPoints', pts);
  setText('dashLevel', level.name + ' ' + level.icon);
  setBar('dashLevelBar', level.progress);

  const nextLevelText = level.nextLevel
    ? `Faltam ${level.nextLevel.min - pts} pts para ${level.nextLevel.name} ${level.nextLevel.icon}`
    : 'Você atingiu o nível máximo! ⭐';
  setText('dashLevelNext', nextLevelText);

  // Mensagem motivacional
  renderMotivationalMessage(waterPct, actMins, lastSleep, goalStats);
}

function renderMotivationalMessage(waterPct, actMins, lastSleep, goalStats) {
  const msgs = [];

  if (waterPct >= 100) msgs.push('Hidratação completa! Seu corpo agradece. 💧');
  else if (waterPct >= 60) msgs.push('Ótimo progresso na hidratação! Continue assim. 💪');
  else msgs.push('Lembre-se de beber água regularmente ao longo do dia. 💧');

  if (actMins >= 30) msgs.push('Você se movimentou hoje! Isso faz toda a diferença. 🏃');
  else msgs.push('Que tal incluir uma caminhada na sua rotina hoje? 🚶');

  if (lastSleep) {
    const hrs = lastSleep.durationMinutes / 60;
    if (hrs >= 7) msgs.push('Você dormiu bem ontem! Sono é a base da saúde. 😴');
    else msgs.push('Tente descansar um pouco mais esta noite. O sono é fundamental. 🌙');
  }

  if (goalStats.total > 0 && goalStats.completed === goalStats.total) {
    msgs.push('Todas as metas de hoje concluídas! Você é incrível. 🎯');
  } else if (goalStats.completed > 0) {
    msgs.push(`${goalStats.completed} meta(s) concluída(s) hoje. Continue avançando! 🎯`);
  }

  const motivations = [
    'Cada pequeno hábito saudável conta. Continue cuidando de você. ❤️',
    'A sua saúde é o seu maior patrimônio. Cuide bem dela! 🌿',
    'Você está indo muito bem! Orgulhe-se do seu progresso. ⭐',
    'Consistência é mais importante do que perfeição. Um passo de cada vez. 🌱',
    'Hoje é um ótimo dia para cuidar de você. Vamos juntos! 💚',
  ];

  const extra = motivations[new Date().getDay() % motivations.length];
  msgs.push(extra);

  const chosen = msgs[Math.floor(Math.random() * msgs.length)];
  setText('motivationalText', chosen);
}

/* ============================================================
   HIDRATAÇÃO
   ============================================================ */

let goalEditOpen = false;

function renderHydration() {
  const profile  = getProfile();
  const goal     = profile.waterGoal || 2000;
  const total    = getTodayWaterTotal();
  const pct      = Math.min(100, (total / goal) * 100);
  const remaining = Math.max(0, goal - total);

  // Círculo SVG
  const circle = document.getElementById('hydCircle');
  if (circle) {
    const circumference = 326.7;
    const offset = circumference - (pct / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }

  setText('hydAmount', total);
  setText('hydConsumed', fmtMlFull(total));
  setText('hydRemaining', fmtMlFull(remaining));
  setText('hydGoalDisplay', fmtMlFull(goal));

  // Mensagem
  let msg = '';
  if (pct >= 100) msg = '🎉 Meta atingida! Parabéns por se manter hidratado!';
  else if (pct >= 75) msg = `Quase lá! Faltam apenas ${fmtMlFull(remaining)} para atingir sua meta.`;
  else if (pct >= 50) msg = `Bom progresso! Faltam ${fmtMlFull(remaining)} para completar a meta.`;
  else if (pct > 0)   msg = `Continue bebendo água! Faltam ${fmtMlFull(remaining)} para atingir sua meta.`;
  else                msg = 'Vamos começar o dia bem hidratado! 💪';
  setText('hydMessage', msg);

  // Histórico do dia
  renderHydrationHistory();
}

function renderHydrationHistory() {
  const list    = document.getElementById('hydHistoryList');
  if (!list) return;
  const records = getTodayWater();

  if (records.length === 0) {
    list.innerHTML = '<p class="empty-text">Nenhum registro ainda hoje.</p>';
    return;
  }

  list.innerHTML = records.slice().reverse().map(r => `
    <div class="history-item">
      <div class="history-item-info">
        <span class="history-item-icon">💧</span>
        <div>
          <div class="history-item-text">${fmtMlFull(r.amount)}</div>
          <div class="history-item-sub">${r.time}</div>
        </div>
      </div>
      <button class="btn-icon" onclick="deleteWaterRecord(${r.id})" aria-label="Remover registro" title="Remover">🗑️</button>
    </div>
  `).join('');
}

function addWater(amount) {
  addWaterRecord(amount);
  showToast(`+${fmtMlFull(amount)} adicionados! 💧`);
  renderHydration();
  renderDashboard();
  checkWaterGoalAchieved();
}

function addCustomWater() {
  const input = document.getElementById('customWaterInput');
  if (!input) return;
  const val = parseInt(input.value, 10);
  if (!val || val <= 0 || val > 5000) {
    showToast('Informe uma quantidade válida (1–5000 ml).');
    return;
  }
  addWater(val);
  input.value = '';
}

function undoLastWater() {
  const removed = removeLastWaterRecord();
  if (removed) {
    showToast('Último registro removido. ↩');
    renderHydration();
    renderDashboard();
  } else {
    showToast('Nenhum registro para desfazer.');
  }
}

function deleteWaterRecord(id) {
  removeWaterRecord(id);
  showToast('Registro removido.');
  renderHydration();
  renderDashboard();
}

function toggleGoalEdit() {
  const area = document.getElementById('goalEditArea');
  if (!area) return;
  goalEditOpen = !goalEditOpen;
  area.style.display = goalEditOpen ? 'block' : 'none';
  if (goalEditOpen) {
    const input = document.getElementById('hydGoalInput');
    if (input) {
      const profile = getProfile();
      input.value = profile.waterGoal || 2000;
      input.focus();
    }
  }
}

function saveHydGoal() {
  const input = document.getElementById('hydGoalInput');
  if (!input) return;
  const val = parseInt(input.value, 10);
  if (!val || val < 500 || val > 6000) {
    showToast('Informe uma meta entre 500 e 6000 ml.');
    return;
  }
  const profile = getProfile();
  profile.waterGoal = val;
  saveProfileData(profile);
  goalEditOpen = false;
  const area = document.getElementById('goalEditArea');
  if (area) area.style.display = 'none';
  showToast('Meta de água atualizada! 💧');
  renderHydration();
  renderDashboard();
}

function checkWaterGoalAchieved() {
  const profile = getProfile();
  const goal    = profile.waterGoal || 2000;
  const total   = getTodayWaterTotal();
  if (total >= goal) {
    // Pontos uma vez por dia
    const key = 'waterGoalAchieved_' + todayStr();
    if (!localStorage.getItem(key)) {
      addPoints(20);
      localStorage.setItem(key, '1');
      showToast('🎉 Meta de água atingida! +20 pontos!', 3500);
    }
  }
}

/* ============================================================
   ATIVIDADE FÍSICA
   ============================================================ */

let currentGoalTab = 'daily'; // shared with goals section naming

function renderActivity() {
  // Preenche data com hoje
  const dateInput = document.getElementById('actDate');
  if (dateInput && !dateInput.value) dateInput.value = todayStr();

  // Resumo semanal
  const weekRecs  = getWeekActivityRecords();
  const weekMins  = weekRecs.reduce((s, r) => s + Number(r.duration), 0);
  setText('actWeekCount', weekRecs.length);
  setText('actWeekMin', weekMins);

  const profile    = getProfile();
  const weekGoal   = profile.activityGoalWeekly || 150;
  let msg = '';
  if (weekRecs.length === 0) msg = 'Comece registrando sua primeira atividade!';
  else if (weekMins >= weekGoal) msg = `Meta semanal atingida! Você realizou ${weekMins} min esta semana. 🎉`;
  else msg = `Você realizou ${weekRecs.length} atividade(s) esta semana — ${weekMins} min de ${weekGoal} min meta.`;
  setText('actSummaryMsg', msg);

  // Lista de atividades
  renderActivityList();
}

function renderActivityList() {
  const list = document.getElementById('activityList');
  if (!list) return;
  const records = getActivityRecords().slice().sort((a, b) => b.date.localeCompare(a.date));

  if (records.length === 0) {
    list.innerHTML = '<p class="empty-text">Nenhuma atividade registrada ainda.</p>';
    return;
  }

  const iconMap = {
    'Caminhada': '🚶', 'Corrida': '🏃', 'Academia': '🏋️',
    'Bicicleta': '🚴', 'Alongamento': '🧘', 'Esporte': '⚽', 'Outro': '✨'
  };

  const today = todayStr();
  list.innerHTML = records.map(r => {
    const icon      = iconMap[r.type] || '🏃';
    const dateLabel = r.date === today ? 'Hoje' : formatDateLabel(r.date);
    return `
      <div class="history-item">
        <div class="history-item-info">
          <span class="history-item-icon">${icon}</span>
          <div>
            <div class="history-item-text">${r.type}</div>
            <div class="history-item-sub">${r.duration} min · ${dateLabel}</div>
          </div>
        </div>
        <button class="btn-icon" onclick="deleteActivity(${r.id})" aria-label="Excluir atividade" title="Excluir">🗑️</button>
      </div>
    `;
  }).join('');
}

function saveActivity() {
  const type     = document.getElementById('actType')?.value;
  const duration = parseInt(document.getElementById('actDuration')?.value, 10);
  const date     = document.getElementById('actDate')?.value;

  if (!type)                    { showToast('Selecione o tipo de atividade.'); return; }
  if (!duration || duration <= 0) { showToast('Informe a duração em minutos.'); return; }
  if (duration > 600)            { showToast('Duração máxima: 600 minutos.'); return; }
  if (!date)                    { showToast('Informe a data.'); return; }

  saveActivityRecord({ type, duration, date });
  addPoints(10);
  showToast(`${type} registrada! +10 pontos. 🏃`);

  // Limpa form
  const durInput = document.getElementById('actDuration');
  if (durInput) durInput.value = '';

  renderActivity();
  renderDashboard();
}

function deleteActivity(id) {
  showConfirm('Excluir atividade', 'Deseja remover este registro de atividade?', () => {
    removeActivityRecord(id);
    showToast('Atividade removida.');
    renderActivity();
    renderDashboard();
  });
}

/* ============================================================
   SONO
   ============================================================ */

function renderSleep() {
  // Preenche data com hoje
  const dateInput = document.getElementById('sleepDate');
  if (dateInput && !dateInput.value) dateInput.value = todayStr();

  // Último registro
  const last = getLastSleep();
  const profile = getProfile();
  const sleepGoalH = profile.sleepGoal || 8;
  setText('sleepGoalText', `Meta: ${sleepGoalH} horas`);

  if (last) {
    setText('sleepLastVal', formatDuration(last.durationMinutes));
    const pct = Math.min(100, (last.durationMinutes / (sleepGoalH * 60)) * 100);
    setBar('sleepLastBar', pct);
  } else {
    setText('sleepLastVal', 'Sem registro');
    setBar('sleepLastBar', 0);
  }

  // Mini gráfico histórico
  renderSleepChart();

  // Lista
  renderSleepList();
}

function renderSleepChart() {
  const wrap = document.getElementById('sleepHistoryChart');
  if (!wrap) return;
  const days    = getLast7Days();
  const profile = getProfile();
  const goal    = (profile.sleepGoal || 8) * 60; // em minutos

  // Máximo para escala
  let maxVal = goal;
  days.forEach(d => {
    const rec = getSleepForDate(d);
    if (rec && rec.durationMinutes > maxVal) maxVal = rec.durationMinutes;
  });

  wrap.innerHTML = days.map(d => {
    const rec    = getSleepForDate(d);
    const mins   = rec ? rec.durationMinutes : 0;
    const heightPct = maxVal > 0 ? (mins / maxVal) * 100 : 0;
    const label  = dayNameShort(d);
    const val    = mins > 0 ? formatDuration(mins) : '';
    return `
      <div class="sleep-bar-item">
        <div class="bar" style="height:${heightPct}%" title="${val || 'sem registro'}"></div>
        <span class="bar-day">${label}</span>
      </div>
    `;
  }).join('');
}

function renderSleepList() {
  const list = document.getElementById('sleepList');
  if (!list) return;
  const records = getSleepRecords();

  if (records.length === 0) {
    list.innerHTML = '<p class="empty-text">Nenhum registro de sono ainda.</p>';
    return;
  }

  const today = todayStr();
  list.innerHTML = records.slice(0, 14).map(r => {
    const dateLabel = r.date === today ? 'Hoje' : formatDateLabel(r.date);
    const quality   = r.durationMinutes >= 420 ? '😊' : r.durationMinutes >= 300 ? '😐' : '😔';
    return `
      <div class="history-item">
        <div class="history-item-info">
          <span class="history-item-icon">🌙</span>
          <div>
            <div class="history-item-text">${formatDuration(r.durationMinutes)} ${quality}</div>
            <div class="history-item-sub">${dateLabel} · ${r.sleepTime} → ${r.wakeTime}</div>
          </div>
        </div>
        <button class="btn-icon" onclick="deleteSleep(${r.id})" aria-label="Excluir registro" title="Excluir">🗑️</button>
      </div>
    `;
  }).join('');
}

function updateSleepPreview() {
  const start   = document.getElementById('sleepStart')?.value;
  const end     = document.getElementById('sleepEnd')?.value;
  const preview = document.getElementById('sleepPreview');
  const durEl   = document.getElementById('sleepCalcDuration');

  if (start && end && preview && durEl) {
    const mins = calcSleepDuration(start, end);
    durEl.textContent = formatDuration(mins);
    preview.style.display = 'block';
  } else if (preview) {
    preview.style.display = 'none';
  }
}

function saveSleep() {
  const date  = document.getElementById('sleepDate')?.value;
  const start = document.getElementById('sleepStart')?.value;
  const end   = document.getElementById('sleepEnd')?.value;

  if (!date)  { showToast('Informe a data.'); return; }
  if (!start) { showToast('Informe o horário que dormiu.'); return; }
  if (!end)   { showToast('Informe o horário que acordou.'); return; }

  const durationMinutes = calcSleepDuration(start, end);
  if (durationMinutes < 30)  { showToast('Duração muito curta. Verifique os horários.'); return; }
  if (durationMinutes > 720) { showToast('Duração máxima: 12 horas. Verifique os horários.'); return; }

  saveSleepRecord({ date, sleepTime: start, wakeTime: end, durationMinutes });
  addPoints(5);
  showToast(`Sono registrado: ${formatDuration(durationMinutes)}! +5 pontos. 😴`);

  // Limpa form
  const startEl = document.getElementById('sleepStart');
  const endEl   = document.getElementById('sleepEnd');
  if (startEl) startEl.value = '';
  if (endEl)   endEl.value   = '';
  const preview = document.getElementById('sleepPreview');
  if (preview) preview.style.display = 'none';

  renderSleep();
  renderDashboard();
}

function deleteSleep(id) {
  showConfirm('Excluir registro de sono', 'Deseja remover este registro?', () => {
    removeSleepRecord(id);
    showToast('Registro de sono removido.');
    renderSleep();
    renderDashboard();
  });
}

/* ============================================================
   METAS
   ============================================================ */

const SUGGESTED_GOALS = [
  { text: '💧 Beber minha meta de água', freq: 'daily' },
  { text: '🏃 Fazer atividade física', freq: 'daily' },
  { text: '😴 Dormir pelo menos 7 horas', freq: 'daily' },
  { text: '🧘 Fazer alongamento', freq: 'daily' },
  { text: '☕ Fazer uma pausa durante o trabalho', freq: 'daily' },
  { text: '🚶 Fazer uma caminhada', freq: 'daily' },
  { text: '📵 Reduzir tempo de tela antes de dormir', freq: 'daily' },
  { text: '🥗 Comer frutas e vegetais', freq: 'weekly' },
  { text: '🏋️ Ir à academia 3 vezes', freq: 'weekly' },
  { text: '📖 Ler algo educativo sobre saúde', freq: 'weekly' },
];

let activeGoalTab = 'daily';

function renderGoals() {
  renderGoalsSummary();
  renderSuggestedChips();
  renderGoalsList();
}

function renderGoalsSummary() {
  const today = todayStr();
  const stats = getDailyGoalStats(today);
  const pct   = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  setText('goalsSummaryVal', `${stats.completed}/${stats.total} concluídas`);
  setText('goalsPercent', pct + '%');
  setBar('goalsProgressBar', pct);
}

function renderSuggestedChips() {
  const wrap = document.getElementById('suggestedChips');
  if (!wrap) return;
  const existing = getGoals().map(g => g.text.toLowerCase());
  const available = SUGGESTED_GOALS.filter(s => !existing.includes(s.text.toLowerCase()));

  if (available.length === 0) {
    wrap.innerHTML = '<span style="font-size:12px;color:var(--text-light)">Todas as sugestões já foram adicionadas!</span>';
    return;
  }

  wrap.innerHTML = available.slice(0, 6).map(s => `
    <span class="chip" onclick="addSuggestedGoal('${s.text.replace(/'/g, "\\'")}','${s.freq}')">${s.text}</span>
  `).join('');
}

function addSuggestedGoal(text, freq) {
  addGoal(text, freq);
  addPoints(5);
  showToast('Meta adicionada! 🎯');
  renderGoals();
}

function switchGoalTab(tab, btn) {
  activeGoalTab = tab;
  document.querySelectorAll('.goals-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderGoalsList();
}

function renderGoalsList() {
  const list = document.getElementById('goalsList');
  if (!list) return;
  const goals = getGoals().filter(g => g.freq === activeGoalTab);

  if (goals.length === 0) {
    list.innerHTML = `<p class="empty-text">Nenhuma meta ${activeGoalTab === 'daily' ? 'diária' : 'semanal'} cadastrada ainda.</p>`;
    return;
  }

  list.innerHTML = goals.map(g => {
    const done = isGoalCompletedToday(g.id);
    const freq = g.freq === 'daily' ? 'Diária' : 'Semanal';
    return `
      <div class="goal-item ${done ? 'completed' : ''}" id="goal-item-${g.id}">
        <div class="goal-checkbox ${done ? 'checked' : ''}" onclick="toggleGoal(${g.id})" role="checkbox" aria-checked="${done}" tabindex="0">
          ${done ? '✓' : ''}
        </div>
        <div class="goal-main">
          <span class="goal-text">${escapeHtml(g.text)}</span>
          <span class="goal-freq">${freq}</span>
        </div>
        <div class="goal-actions">
          <button class="btn-icon" onclick="openEditGoal(${g.id})" aria-label="Editar meta" title="Editar">✏️</button>
          <button class="btn-icon" onclick="deleteGoal(${g.id})" aria-label="Excluir meta" title="Excluir">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleGoal(id) {
  const completed = toggleGoalCompletion(id);
  if (completed) {
    addPoints(15);
    showToast('Meta concluída! +15 pontos. 🎯');
  } else {
    showToast('Meta desmarcada.');
  }
  renderGoalsList();
  renderGoalsSummary();
  renderDashboard();
}

function saveGoal() {
  const textEl = document.getElementById('goalText');
  const freqEl = document.getElementById('goalFreq');
  if (!textEl || !freqEl) return;

  const text = textEl.value.trim();
  const freq = freqEl.value;

  if (!text) { showToast('Descreva sua meta antes de salvar.'); return; }
  if (text.length > 100) { showToast('Meta muito longa. Máximo 100 caracteres.'); return; }

  addGoal(text, freq);
  addPoints(5);
  showToast('Meta criada! +5 pontos. 🎯');
  textEl.value = '';

  // Muda para a aba correspondente
  const tabBtn = document.getElementById(freq === 'daily' ? 'tabDailyBtn' : 'tabWeeklyBtn');
  switchGoalTab(freq, tabBtn);

  renderGoals();
  renderDashboard();
}

function deleteGoal(id) {
  showConfirm('Excluir meta', 'Deseja remover esta meta permanentemente?', () => {
    removeGoal(id);
    showToast('Meta removida.');
    renderGoals();
    renderDashboard();
  });
}

function openEditGoal(id) {
  const goals = getGoals();
  const goal  = goals.find(g => g.id === id);
  if (!goal) return;
  document.getElementById('editGoalId').value   = id;
  document.getElementById('editGoalText').value = goal.text;
  document.getElementById('editGoalModal').style.display = 'flex';
  document.body.classList.add('modal-open');
}

function saveEditGoal() {
  const id   = parseInt(document.getElementById('editGoalId')?.value, 10);
  const text = document.getElementById('editGoalText')?.value.trim();
  if (!text) { showToast('A descrição não pode ficar vazia.'); return; }
  updateGoalText(id, text);
  closeEditGoal();
  showToast('Meta atualizada!');
  renderGoals();
}

function closeEditGoal() {
  const modal = document.getElementById('editGoalModal');
  if (modal) modal.style.display = 'none';
  if (!isAnyModalOpen()) document.body.classList.remove('modal-open');
}

/* ============================================================
   PROGRESSO
   ============================================================ */

function renderProgress() {
  const days    = getLast7Days();
  const profile = getProfile();

  // Água — média 7 dias
  const waterVals = days.map(d => getWaterForDate(d));
  const waterAvg  = Math.round(waterVals.reduce((a, b) => a + b, 0) / 7);
  setText('statWaterAvg', fmtMl(waterAvg));

  // Atividade — total 7 dias
  const actVals   = days.map(d => getActivityMinutesForDate(d));
  const actTotal  = actVals.reduce((a, b) => a + b, 0);
  setText('statActTotal', actTotal + ' min');

  // Sono — média 7 dias
  const sleepVals = days.map(d => {
    const rec = getSleepForDate(d);
    return rec ? rec.durationMinutes : 0;
  });
  const sleepDays = sleepVals.filter(v => v > 0).length;
  const sleepAvg  = sleepDays > 0
    ? Math.round(sleepVals.reduce((a, b) => a + b, 0) / sleepDays)
    : 0;
  setText('statSleepAvg', sleepAvg > 0 ? formatDuration(sleepAvg) : '0h');

  // Metas — taxa 7 dias
  const goalRates = days.map(d => {
    const s = getDailyGoalStats(d);
    return s.total > 0 ? (s.completed / s.total) * 100 : 0;
  });
  const daysWithGoals = days.filter(d => getDailyGoalStats(d).total > 0).length;
  const goalRate = daysWithGoals > 0
    ? Math.round(goalRates.reduce((a, b) => a + b, 0) / daysWithGoals)
    : 0;
  setText('statGoalsRate', goalRate + '%');

  // Gráficos
  renderBarChart('waterChart', days, waterVals, '#3AACDA', v => fmtMl(v), profile.waterGoal || 2000);
  renderBarChart('activityChart', days, actVals, 'var(--primary)', v => v + ' min', 30);
  renderBarChart('sleepChart', days, sleepVals.map(v => Math.round(v / 60 * 10) / 10), '#8B6FBF', v => v + 'h', profile.sleepGoal || 8);
  renderBarChart('goalsChart', days, goalRates.map(v => Math.round(v)), 'var(--goals)', v => v + '%', 100);

  // Resumo textual
  renderWeeklySummary(waterAvg, actTotal, sleepAvg, goalRate, profile);
}

function renderBarChart(containerId, days, values, color, labelFn, goal) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const maxVal = Math.max(...values, goal || 1, 1);

  wrap.innerHTML = days.map((d, i) => {
    const val      = values[i] || 0;
    const heightPct = (val / maxVal) * 100;
    const dayLabel  = dayNameShort(d);
    const valLabel  = val > 0 ? labelFn(val) : '–';
    const isToday   = d === todayStr();
    const barColor  = isToday ? color : color + 'AA';

    return `
      <div class="chart-col">
        <div class="chart-bar-val">${valLabel}</div>
        <div class="chart-bar" style="height:${Math.max(2, heightPct)}%;background:${barColor}" title="${dayLabel}: ${valLabel}"></div>
        <div class="chart-day" style="${isToday ? 'font-weight:700;color:var(--primary)' : ''}">${dayLabel}</div>
      </div>
    `;
  }).join('');
}

function renderWeeklySummary(waterAvg, actTotal, sleepAvgMin, goalRate, profile) {
  const waterGoal  = profile.waterGoal || 2000;
  const actGoal    = profile.activityGoalWeekly || 150;
  const sleepGoalH = profile.sleepGoal || 8;
  const sleepAvgH  = sleepAvgMin / 60;

  const lines = [];

  if (waterAvg >= waterGoal) lines.push(`💧 Excelente hidratação! Média de ${fmtMl(waterAvg)}/dia — meta atingida.`);
  else lines.push(`💧 Média de ${fmtMl(waterAvg)}/dia — tente alcançar sua meta de ${fmtMl(waterGoal)}.`);

  if (actTotal >= actGoal) lines.push(`🏃 Meta semanal de atividade atingida! ${actTotal} min realizados.`);
  else if (actTotal > 0) lines.push(`🏃 ${actTotal} min de atividade esta semana — meta: ${actGoal} min.`);
  else lines.push('🏃 Sem atividades registradas esta semana. Que tal começar amanhã?');

  if (sleepAvgMin > 0) {
    if (sleepAvgH >= sleepGoalH) lines.push(`😴 Ótimo sono! Média de ${formatDuration(sleepAvgMin)}/noite.`);
    else lines.push(`😴 Média de ${formatDuration(sleepAvgMin)}/noite — tente dormir pelo menos ${sleepGoalH}h.`);
  } else {
    lines.push('😴 Registre seu sono para acompanhar o descanso.');
  }

  if (goalRate >= 80) lines.push(`🎯 Parabéns! Você completou ${goalRate}% das suas metas nesta semana.`);
  else if (goalRate > 0) lines.push(`🎯 Você completou ${goalRate}% das suas metas — continue progredindo!`);
  else lines.push('🎯 Adicione e conclua metas para acompanhar seu progresso.');

  setText('progressWeeklySummary', lines.join('\n\n'));
  const el = document.getElementById('progressWeeklySummary');
  if (el) el.style.whiteSpace = 'pre-line';
}

/* ============================================================
   CONTEÚDOS EDUCATIVOS
   ============================================================ */

const ARTICLES = [
  {
    id: 1, emoji: '💧', tag: 'Hidratação',
    title: 'A importância de se manter hidratado',
    preview: 'Água é essencial para todas as funções do corpo. Saiba quanto você precisa.',
    body: 'A água é o principal componente do corpo humano, representando cerca de 60% do peso corporal em adultos. Ela participa de praticamente todos os processos fisiológicos, desde a regulação da temperatura até o transporte de nutrientes e a eliminação de resíduos.\n\nA desidratação, mesmo leve (1-2% do peso corporal), pode causar fadiga, dificuldade de concentração, dores de cabeça e redução do desempenho físico e cognitivo.',
    tips: [
      'Beba água regularmente ao longo do dia, sem esperar sentir sede.',
      'Mantenha sempre uma garrafinha de água por perto.',
      'Aumente o consumo em dias quentes ou durante exercícios.',
      'Frutas e vegetais também contribuem para a hidratação diária.',
      'Observe a cor da urina: amarelo claro indica boa hidratação.',
    ]
  },
  {
    id: 2, emoji: '🏃', tag: 'Atividade Física',
    title: 'Benefícios da atividade física regular',
    preview: 'Movimentar-se faz bem ao corpo e à mente. Descubra por que.',
    body: 'A prática regular de atividade física é um dos pilares mais importantes de um estilo de vida saudável. Os benefícios vão muito além da estética ou do condicionamento físico.\n\nAtividades físicas regulares ajudam a reduzir o risco de doenças crônicas, melhoram o humor, aumentam a energia, contribuem para um sono de melhor qualidade e fortalecem o sistema imunológico.',
    tips: [
      'Comece com pequenas caminhadas e aumente gradualmente a intensidade.',
      'A Organização Mundial da Saúde recomenda pelo menos 150 min/semana de atividade moderada.',
      'Encontre uma atividade que você goste — é mais fácil manter a consistência.',
      'Inclua exercícios de força, equilíbrio e flexibilidade na rotina.',
      'Intervalos ativos durante o trabalho já fazem diferença.',
    ]
  },
  {
    id: 3, emoji: '😴', tag: 'Sono',
    title: 'Por que o sono é fundamental para a saúde',
    preview: 'Dormir bem é tão importante quanto se alimentar bem. Entenda por quê.',
    body: 'O sono é uma necessidade biológica fundamental, durante a qual o corpo realiza processos essenciais: consolida memórias, repara tecidos, regula hormônios e fortalece o sistema imunológico.\n\nAdultos geralmente precisam de 7 a 9 horas de sono por noite. A privação crônica está associada a maior risco de doenças cardiovasculares, diabetes tipo 2, obesidade e problemas de saúde mental.',
    tips: [
      'Mantenha horários regulares para dormir e acordar, inclusive nos fins de semana.',
      'Evite telas (celular, TV) pelo menos 30 minutos antes de dormir.',
      'Deixe o quarto escuro, silencioso e fresco.',
      'Evite cafeína à tarde e à noite.',
      'Atividade física regular melhora a qualidade do sono.',
    ]
  },
  {
    id: 4, emoji: '🧠', tag: 'Saúde Mental',
    title: 'Saúde mental e qualidade de vida',
    preview: 'Cuidar da mente é tão essencial quanto cuidar do corpo.',
    body: 'Saúde mental é um estado de bem-estar no qual a pessoa consegue lidar com os estresses normais da vida, trabalhar de forma produtiva e contribuir com sua comunidade. É uma parte integral da saúde global — não há saúde sem saúde mental.\n\nPraticar o autocuidado, cultivar relacionamentos saudáveis, gerenciar o estresse e buscar ajuda quando necessário são atitudes fundamentais para o bem-estar mental.',
    tips: [
      'Reserve tempo para atividades que você aprecia e que promovem relaxamento.',
      'Pratique técnicas de respiração ou meditação simples.',
      'Mantenha conexões sociais — o isolamento prejudica a saúde mental.',
      'Estabeleça limites saudáveis no trabalho e nas redes sociais.',
      'Não hesite em buscar apoio profissional quando necessário.',
    ]
  },
  {
    id: 5, emoji: '🥗', tag: 'Alimentação',
    title: 'Alimentação equilibrada na prática',
    preview: 'Uma dieta variada e colorida é a base de uma vida saudável.',
    body: 'Uma alimentação equilibrada fornece os nutrientes que o corpo precisa para funcionar bem: carboidratos para energia, proteínas para reparação e crescimento, gorduras saudáveis para funções celulares, vitaminas e minerais para inúmeros processos metabólicos.\n\nO padrão alimentar, e não um alimento isolado, é o que mais importa. Priorize alimentos minimamente processados, variedade de cores no prato e atenção ao ato de comer.',
    tips: [
      'Monte o prato com pelo menos metade de vegetais e frutas.',
      'Prefira alimentos in natura ou minimamente processados.',
      'Coma devagar e preste atenção aos sinais de saciedade.',
      'Reduza o consumo de alimentos ultraprocessados e bebidas açucaradas.',
      'Inclua leguminosas (feijão, lentilha, grão-de-bico) regularmente.',
    ]
  },
  {
    id: 6, emoji: '🪥', tag: 'Higiene',
    title: 'Higiene pessoal e prevenção de doenças',
    preview: 'Hábitos simples de higiene protegem você e as pessoas ao redor.',
    body: 'Práticas de higiene pessoal são medidas simples e eficazes para prevenir a transmissão de doenças infecciosas e manter a saúde. A higiene adequada vai além da aparência — é um ato de cuidado com a própria saúde e a das pessoas ao redor.\n\nHábitos como lavar as mãos corretamente, cuidar da saúde bucal e manter a higiene corporal reduzem significativamente o risco de infecções.',
    tips: [
      'Lave as mãos com água e sabão por pelo menos 20 segundos, especialmente antes de comer e após usar o banheiro.',
      'Escove os dentes pelo menos duas vezes ao dia e use fio dental.',
      'Mantenha as unhas limpas e cortadas.',
      'Troque e lave roupas e lençóis regularmente.',
      'Cubra a boca e o nariz ao tossir ou espirrar.',
    ]
  },
  {
    id: 7, emoji: '🚭', tag: 'Prevenção',
    title: 'Riscos do tabagismo para a saúde',
    preview: 'O tabagismo é a principal causa de morte evitável. Saiba mais.',
    body: 'O tabagismo é responsável por milhões de mortes evitáveis a cada ano em todo o mundo. A fumaça do cigarro contém mais de 7.000 substâncias químicas, das quais centenas são tóxicas e cerca de 70 são conhecidas como causadoras de câncer.\n\nAlém do câncer, o tabagismo está associado a doenças cardiovasculares, doenças respiratórias crônicas, infertilidade e diversas outras condições de saúde graves.',
    tips: [
      'Se você não fuma, não comece — é a melhor decisão que pode tomar.',
      'Se você fuma, saiba que parar traz benefícios para a saúde em qualquer idade.',
      'Busque apoio médico ou de grupos de suporte para parar de fumar.',
      'Evite ambientes com fumo passivo, que também causa danos à saúde.',
      'Substitua o hábito do cigarro por atividades saudáveis.',
    ]
  },
  {
    id: 8, emoji: '📱', tag: 'Tecnologia',
    title: 'Uso saudável da tecnologia',
    preview: 'Como equilibrar o tempo de tela e preservar seu bem-estar.',
    body: 'A tecnologia trouxe inúmeros benefícios à vida moderna, mas o uso excessivo e sem consciência pode impactar negativamente a saúde física e mental. Problemas relacionados ao uso excessivo de telas incluem sedentarismo, distúrbios do sono, problemas posturais, ansiedade e dificuldade de concentração.\n\nO equilíbrio é a chave: usar a tecnologia de forma intencional, com pausas regulares e limites conscientes, permite aproveitar seus benefícios sem os malefícios.',
    tips: [
      'Estabeleça horários sem tela, especialmente antes de dormir.',
      'Use a regra 20-20-20: a cada 20 minutos, olhe para algo a 20 pés por 20 segundos.',
      'Desative notificações desnecessárias para reduzir distrações.',
      'Prefira interações presenciais para fortalecer vínculos sociais.',
      'Use aplicativos de saúde (como este!) para transformar a tecnologia em aliada do bem-estar.',
    ]
  },
];

const QUIZ_QUESTIONS = [
  {
    question: 'Qual é a quantidade mínima de atividade física moderada recomendada por semana para adultos?',
    options: ['60 minutos', '150 minutos', '300 minutos', '500 minutos'],
    correct: 1,
    explanation: 'A OMS recomenda pelo menos 150 minutos de atividade física moderada por semana para adultos.',
  },
  {
    question: 'Qual destas atitudes contribui para uma rotina de sono mais saudável?',
    options: ['Usar o celular na cama até dormir', 'Manter horários regulares de sono', 'Tomar café à noite', 'Dormir com a TV ligada'],
    correct: 1,
    explanation: 'Manter horários regulares para dormir e acordar regula o relógio biológico e melhora a qualidade do sono.',
  },
  {
    question: 'O que pode indicar que você está bem hidratado ao longo do dia?',
    options: ['Urina escura e concentrada', 'Sensação constante de sede', 'Urina de cor amarelo claro', 'Boca seca frequente'],
    correct: 2,
    explanation: 'A urina de cor amarelo claro (ou quase transparente) é um bom indicador de hidratação adequada.',
  },
  {
    question: 'Qual hábito NÃO contribui para uma boa saúde mental?',
    options: ['Praticar atividade física', 'Manter conexões sociais', 'Isolar-se dos outros por longos períodos', 'Reservar tempo para o lazer'],
    correct: 2,
    explanation: 'O isolamento social prolongado pode impactar negativamente a saúde mental. Manter conexões é fundamental.',
  },
  {
    question: 'Qual é a proporção recomendada do prato para uma refeição equilibrada?',
    options: ['Metade de proteínas', 'Metade de carboidratos refinados', 'Metade de vegetais e frutas', 'Metade de gorduras'],
    correct: 2,
    explanation: 'Preencher metade do prato com vegetais e frutas é uma estratégia simples para uma alimentação mais equilibrada.',
  },
  {
    question: 'Por quantos segundos é recomendado lavar as mãos para uma higiene eficaz?',
    options: ['5 segundos', '10 segundos', '20 segundos', '60 segundos'],
    correct: 2,
    explanation: 'Lavar as mãos por pelo menos 20 segundos com água e sabão remove efetivamente agentes patogênicos.',
  },
  {
    question: 'Quantas horas de sono por noite são geralmente recomendadas para adultos?',
    options: ['4 a 5 horas', '5 a 6 horas', '7 a 9 horas', '10 a 12 horas'],
    correct: 2,
    explanation: 'A maioria dos adultos precisa de 7 a 9 horas de sono por noite para funcionar de forma otimizada.',
  },
  {
    question: 'Qual prática simples pode ajudar a preservar a saúde dos olhos ao usar telas?',
    options: ['Regra 20-20-20: a cada 20 min, olhe a 20 pés por 20 segundos', 'Usar óculos escuros em ambientes fechados', 'Aumentar o brilho da tela ao máximo', 'Usar o dispositivo no escuro'],
    correct: 0,
    explanation: 'A regra 20-20-20 ajuda a reduzir a fadiga ocular causada pelo uso prolongado de telas.',
  },
];

let quizState = { currentIndex: 0, score: 0, answered: [] };
let activeContentTab = 'articles';

function renderContent() {
  if (activeContentTab === 'articles') renderArticles();
  else renderQuiz();
}

function switchContentTab(tab, btn) {
  activeContentTab = tab;
  document.querySelectorAll('.content-tabs-wrap .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  document.getElementById('contentArticles').style.display = tab === 'articles' ? 'block' : 'none';
  document.getElementById('contentQuiz').style.display     = tab === 'quiz'     ? 'block' : 'none';

  if (tab === 'articles') renderArticles();
  else renderQuiz();
}

function renderArticles() {
  const grid = document.getElementById('articlesGrid');
  if (!grid) return;

  grid.innerHTML = ARTICLES.map(a => `
    <div class="article-card" onclick="openArticle(${a.id})" tabindex="0" role="button" aria-label="${a.title}">
      <div class="article-emoji">${a.emoji}</div>
      <div class="article-title">${a.title}</div>
      <div class="article-preview">${a.preview}</div>
      <span class="article-tag">${a.tag}</span>
    </div>
  `).join('');
}

function openArticle(id) {
  const article = ARTICLES.find(a => a.id === id);
  if (!article) return;

  const content = document.getElementById('articleContent');
  if (!content) return;

  content.innerHTML = `
    <div style="font-size:40px;margin-bottom:12px">${article.emoji}</div>
    <h2 class="article-full-title">${article.title}</h2>
    <p class="article-full-body" style="white-space:pre-line">${article.body}</p>
    <div class="article-tips">
      <h4>💡 Dicas práticas</h4>
      <ul>${article.tips.map(t => `<li>${t}</li>`).join('')}</ul>
    </div>
  `;

  const modal = document.getElementById('articleModal');
  if (modal) modal.style.display = 'flex';
  document.body.classList.add('modal-open');
}

function closeArticle() {
  const modal = document.getElementById('articleModal');
  if (modal) modal.style.display = 'none';
  if (!isAnyModalOpen()) document.body.classList.remove('modal-open');
}

function closeArticleOutside(event) {
  if (event.target === document.getElementById('articleModal')) closeArticle();
}

/* Verifica se algum modal está visivelmente aberto */
function isAnyModalOpen() {
  const ids = ['confirmModal', 'editGoalModal', 'articleModal'];
  return ids.some(id => {
    const el = document.getElementById(id);
    return el && el.style.display !== 'none' && el.style.display !== '';
  });
}

function renderQuiz() {
  const container = document.getElementById('quizContent');
  if (!container) return;

  const saved = getQuizProgress();
  quizState   = { ...saved };

  if (quizState.currentIndex >= QUIZ_QUESTIONS.length) {
    renderQuizScore();
    return;
  }

  const q     = QUIZ_QUESTIONS[quizState.currentIndex];
  const total = QUIZ_QUESTIONS.length;
  const current = quizState.currentIndex + 1;

  container.innerHTML = `
    <p class="quiz-progress">Pergunta ${current} de ${total}</p>
    <div class="progress-bar" style="margin-bottom:16px">
      <div class="progress-fill activity-fill" style="width:${((current-1)/total)*100}%"></div>
    </div>
    <p class="quiz-question">${q.question}</p>
    <div class="quiz-options">
      ${q.options.map((opt, i) => `
        <button class="quiz-option" onclick="answerQuiz(${i})" id="qopt-${i}">${opt}</button>
      `).join('')}
    </div>
    <div class="quiz-feedback" id="quizFeedback"></div>
    <button class="btn btn-primary btn-full" id="quizNextBtn" style="display:none" onclick="nextQuestion()">
      ${quizState.currentIndex + 1 < QUIZ_QUESTIONS.length ? 'Próxima pergunta →' : 'Ver resultado'}
    </button>
  `;
}

function answerQuiz(optionIndex) {
  const q       = QUIZ_QUESTIONS[quizState.currentIndex];
  const correct = q.correct === optionIndex;
  const feedback = document.getElementById('quizFeedback');
  const nextBtn  = document.getElementById('quizNextBtn');

  // Desabilita todos os botões
  document.querySelectorAll('.quiz-option').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct)    btn.classList.add('correct');
    if (i === optionIndex && !correct) btn.classList.add('wrong');
  });

  if (correct) {
    quizState.score++;
    if (feedback) {
      feedback.textContent = '✅ Correto! ' + q.explanation;
      feedback.className = 'quiz-feedback correct';
      feedback.style.display = 'block';
    }
  } else {
    if (feedback) {
      feedback.textContent = '❌ Incorreto. ' + q.explanation;
      feedback.className = 'quiz-feedback wrong';
      feedback.style.display = 'block';
    }
  }

  quizState.answered.push(optionIndex);
  saveQuizProgress(quizState);

  if (nextBtn) nextBtn.style.display = 'block';
}

function nextQuestion() {
  quizState.currentIndex++;
  saveQuizProgress(quizState);
  renderQuiz();
}

function renderQuizScore() {
  const container = document.getElementById('quizContent');
  if (!container) return;

  const score = quizState.score;
  const total = QUIZ_QUESTIONS.length;
  const pct   = Math.round((score / total) * 100);

  let emoji = '🌱'; let msg = 'Continue aprendendo!';
  if (pct >= 90) { emoji = '🏆'; msg = 'Excelente! Você é um especialista em saúde!'; }
  else if (pct >= 70) { emoji = '⭐'; msg = 'Muito bom! Você tem ótimo conhecimento sobre saúde!'; }
  else if (pct >= 50) { emoji = '👍'; msg = 'Bom resultado! Há espaço para aprender mais.'; }

  // Pontos pelo quiz
  const pointsKey = 'quizCompleted_' + new Date().toISOString().slice(0, 10);
  if (!localStorage.getItem(pointsKey)) {
    addPoints(score * 3);
    localStorage.setItem(pointsKey, '1');
  }

  container.innerHTML = `
    <div class="quiz-score-card">
      <div class="quiz-score-emoji">${emoji}</div>
      <div class="quiz-score-text">${score}/${total} respostas corretas</div>
      <div class="quiz-score-sub">${pct}% de aproveitamento<br>${msg}</div>
      <button class="btn btn-primary" onclick="restartQuiz()">Refazer quiz</button>
    </div>
  `;
}

function restartQuiz() {
  resetQuizProgress();
  quizState = { currentIndex: 0, score: 0, answered: [] };
  renderQuiz();
}

/* ============================================================
   PERFIL
   ============================================================ */

function renderProfile() {
  const profile = getProfile();

  const nameEl = document.getElementById('profileName');
  const wgEl   = document.getElementById('profileWaterGoal');
  const agEl   = document.getElementById('profileActivityGoal');
  const sgEl   = document.getElementById('profileSleepGoal');

  if (nameEl) nameEl.value = profile.name || '';
  if (wgEl)   wgEl.value   = profile.waterGoal || 2000;
  if (agEl)   agEl.value   = profile.activityGoalWeekly || 150;
  if (sgEl)   sgEl.value   = profile.sleepGoal || 8;

  // Nível
  const pts   = getPoints();
  const level = getLevelInfo(pts);

  setText('profileLevelName', level.name + ' ' + level.icon);
  setText('profileLevelPts', pts + ' pontos');
  setText('profileLevelBadge', level.icon);
  setBar('profileLevelBar', level.progress);

  const nextText = level.nextLevel
    ? `Faltam ${level.nextLevel.min - pts} pts para ${level.nextLevel.name} ${level.nextLevel.icon}`
    : 'Nível máximo atingido! ⭐';
  setText('profileLevelNext', nextText);
}

function saveProfile() {
  const name = document.getElementById('profileName')?.value.trim() || '';
  const wg   = parseInt(document.getElementById('profileWaterGoal')?.value, 10);
  const ag   = parseInt(document.getElementById('profileActivityGoal')?.value, 10);
  const sg   = parseFloat(document.getElementById('profileSleepGoal')?.value);

  if (wg && (wg < 500 || wg > 6000)) { showToast('Meta de água deve ser entre 500 e 6000 ml.'); return; }
  if (ag && (ag < 10 || ag > 1000))  { showToast('Meta de atividade deve ser entre 10 e 1000 min.'); return; }
  if (sg && (sg < 4 || sg > 12))     { showToast('Meta de sono deve ser entre 4 e 12 horas.'); return; }

  const profile = {
    name: name,
    waterGoal:           wg || 2000,
    activityGoalWeekly:  ag || 150,
    sleepGoal:           sg || 8,
  };

  saveProfileData(profile);
  showToast('Configurações salvas! 👤');
  renderDashboard();
}

/* ============================================================
   MODAL DE CONFIRMAÇÃO
   ============================================================ */

let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  setText('confirmTitle', title);
  setText('confirmMessage', message);
  confirmCallback = onConfirm;
  const modal = document.getElementById('confirmModal');
  if (modal) modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  const okBtn = document.getElementById('confirmOkBtn');
  if (okBtn) okBtn.onclick = executeConfirm;
}

function executeConfirm() {
  // Salva o callback ANTES de fechar (closeConfirm zera confirmCallback)
  const cb = confirmCallback;
  closeConfirm();
  if (typeof cb === 'function') cb();
}

function closeConfirm() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.style.display = 'none';
  confirmCallback = null;
  if (!isAnyModalOpen()) document.body.classList.remove('modal-open');
}

function confirmClearData() {
  showConfirm(
    '⚠️ Limpar todos os dados',
    'Esta ação removerá permanentemente todos os seus dados do aplicativo. Não é possível desfazer.',
    () => {
      clearAllData();
      showToast('Todos os dados foram removidos.');
      renderDashboard();
      navigateTo('dashboard');
    }
  );
}

/* ============================================================
   UTILITÁRIOS GERAIS
   ============================================================ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

function initSleepTimeListeners() {
  const startEl = document.getElementById('sleepStart');
  const endEl   = document.getElementById('sleepEnd');
  if (startEl) startEl.addEventListener('change', updateSleepPreview);
  if (endEl)   endEl.addEventListener('change', updateSleepPreview);
}

function initEnterKeyListeners() {
  // Adicionar água com Enter
  const cwi = document.getElementById('customWaterInput');
  if (cwi) cwi.addEventListener('keydown', e => { if (e.key === 'Enter') addCustomWater(); });

  // Salvar meta de água com Enter
  const hgi = document.getElementById('hydGoalInput');
  if (hgi) hgi.addEventListener('keydown', e => { if (e.key === 'Enter') saveHydGoal(); });

  // Nova meta com Enter
  const gt = document.getElementById('goalText');
  if (gt) gt.addEventListener('keydown', e => { if (e.key === 'Enter') saveGoal(); });
}

function initKeyboardGoalCheckbox() {
  // Teclado para checkboxes de meta (acessibilidade)
  document.getElementById('goalsList')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const checkbox = e.target.closest('.goal-checkbox');
      if (checkbox) {
        e.preventDefault();
        checkbox.click();
      }
    }
  });
}

function init() {
  initNavigation();
  initSleepTimeListeners();
  initEnterKeyListeners();
  initKeyboardGoalCheckbox();

  // Carrega a página inicial
  renderDashboard();

  // Fecha modais ao clicar fora
  document.getElementById('confirmModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('confirmModal')) closeConfirm();
  });
  document.getElementById('editGoalModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('editGoalModal')) closeEditGoal();
  });

  // Fechar modais com ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeArticle();
      closeConfirm();
      closeEditGoal();
    }
  });
}

// Aguarda o DOM estar pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
