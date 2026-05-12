// ===== Firebase 초기화 =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBYH1rj9gZ0TgHS-LjsBMjLknYDN5ztTwI",
  authDomain: "minsung-exercise.firebaseapp.com",
  projectId: "minsung-exercise",
  storageBucket: "minsung-exercise.firebasestorage.app",
  messagingSenderId: "678237836364",
  appId: "1:678237836364:web:7f6c3c2d4160c6099310e9"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const COLLECTION = "exercise_logs";

// ===== 전역 상태 =====
let allData = [];
let weightChart = null;
let efficiencyChart = null;
let countChart = null;

// ===== 유틸 =====
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("show");
  void t.offsetWidth;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function showLoading(text = "저장 중...") {
  const el = document.getElementById("loadingOverlay");
  el.querySelector(".loading-text").textContent = text;
  el.classList.add("show");
}
function hideLoading() {
  document.getElementById("loadingOverlay").classList.remove("show");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

// ===== 헤더 날짜 =====
function setHeaderDate() {
  const now = new Date();
  const days = ["일","월","화","수","목","금","토"];
  document.getElementById("headerDate").textContent =
    `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")} (${days[now.getDay()]})`;
}

// ===== 탭 네비 =====
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "chart") renderCharts();
      if (btn.dataset.tab === "history") renderHistory();
    });
  });
}

// ===== 기록 폼 =====
function initRecordForm() {
  // 오늘 날짜 기본값
  document.getElementById("recDate").value = getToday();

  // 운동 타입 버튼
  document.querySelectorAll(".type-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("recType").value = btn.dataset.type;
    });
  });

  // 체중 실시간 차이 계산
  ["recWeightBefore","recWeightAfter"].forEach(id => {
    document.getElementById(id).addEventListener("input", updateWeightDiff);
  });

  // 저장 버튼
  document.getElementById("btnSave").addEventListener("click", saveRecord);
}

function updateWeightDiff() {
  const before = parseFloat(document.getElementById("recWeightBefore").value);
  const after = parseFloat(document.getElementById("recWeightAfter").value);
  const box = document.getElementById("weightDiffBox");
  const text = document.getElementById("weightDiffText");

  if (!isNaN(before) && !isNaN(after)) {
    const diff = after - before;
    box.style.display = "block";
    if (diff < 0) {
      text.textContent = `🔥 운동 후 ${Math.abs(diff).toFixed(2)}kg 감소!`;
      text.style.color = "#00e5ff";
    } else if (diff > 0) {
      text.textContent = `📈 운동 후 ${diff.toFixed(2)}kg 증가`;
      text.style.color = "#ff6b35";
    } else {
      text.textContent = `➡️ 운동 전후 변화 없음`;
      text.style.color = "#8b90a7";
    }
  } else {
    box.style.display = "none";
  }
}

async function saveRecord() {
  const date = document.getElementById("recDate").value;
  const type = document.getElementById("recType").value;
  const duration = parseFloat(document.getElementById("recDuration").value);
  const distance = parseFloat(document.getElementById("recDistance").value);
  const weightBefore = parseFloat(document.getElementById("recWeightBefore").value);
  const weightAfter = parseFloat(document.getElementById("recWeightAfter").value);
  const memo = document.getElementById("recMemo").value.trim();

  if (!date) { showToast("❌ 날짜를 입력해주세요!"); return; }
  if (isNaN(duration) || duration <= 0) { showToast("❌ 운동 시간을 입력해주세요!"); return; }
  if (isNaN(weightBefore)) { showToast("❌ 운동 전 체중을 입력해주세요!"); return; }
  if (isNaN(weightAfter)) { showToast("❌ 운동 후 체중을 입력해주세요!"); return; }

  const record = {
    date,
    type,
    duration,
    distance: isNaN(distance) ? 0 : distance,
    weightBefore,
    weightAfter,
    weightDiff: parseFloat((weightAfter - weightBefore).toFixed(2)),
    memo,
    createdAt: new Date().toISOString()
  };

  showLoading("저장 중...");
  try {
    await addDoc(collection(db, COLLECTION), record);
    allData.push({ ...record, id: Date.now().toString() });
    allData.sort((a,b) => b.date.localeCompare(a.date));
    showToast("✅ 기록이 저장되었습니다!");
    showTodaySummary(record);
    clearForm();
    await loadData();
  } catch(e) {
    console.error(e);
    showToast("❌ 저장 실패! 네트워크를 확인해주세요.");
  } finally {
    hideLoading();
  }
}

function showTodaySummary(record) {
  const box = document.getElementById("todaySummary");
  const content = document.getElementById("todaySummaryContent");
  const diff = record.weightDiff;
  const diffText = diff < 0 ? `🔥 ${Math.abs(diff).toFixed(2)}kg 감소` : diff > 0 ? `📈 ${diff.toFixed(2)}kg 증가` : `➡️ 변화 없음`;
  const typeText = record.type === "walking" ? "🚶 걷기" : "🏃 달리기";

  content.innerHTML = `
    <div class="summary-row"><span class="summary-label">날짜</span><span class="summary-value">${formatDate(record.date)}</span></div>
    <div class="summary-row"><span class="summary-label">운동 종류</span><span class="summary-value">${typeText}</span></div>
    <div class="summary-row"><span class="summary-label">운동 시간</span><span class="summary-value">${record.duration}분</span></div>
    <div class="summary-row"><span class="summary-label">거리</span><span class="summary-value">${record.distance}km</span></div>
    <div class="summary-row"><span class="summary-label">운동 전 체중</span><span class="summary-value">${record.weightBefore}kg</span></div>
    <div class="summary-row"><span class="summary-label">운동 후 체중</span><span class="summary-value">${record.weightAfter}kg</span></div>
    <div class="summary-row"><span class="summary-label">체중 변화</span><span class="summary-value">${diffText}</span></div>
    ${record.memo ? `<div class="summary-row"><span class="summary-label">메모</span><span class="summary-value">${record.memo}</span></div>` : ""}
  `;
  box.style.display = "block";
}

function clearForm() {
  document.getElementById("recDate").value = getToday();
  document.getElementById("recDuration").value = "";
  document.getElementById("recDistance").value = "";
  document.getElementById("recWeightBefore").value = "";
  document.getElementById("recWeightAfter").value = "";
  document.getElementById("recMemo").value = "";
  document.getElementById("weightDiffBox").style.display = "none";
}

// ===== 데이터 로드 =====
async function loadData() {
  try {
    const q = query(collection(db, COLLECTION), orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    allData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    updateFilterMonths();
  } catch(e) {
    console.error("데이터 로드 오류:", e);
  }
}

// ===== 히스토리 =====
function updateFilterMonths() {
  const sel = document.getElementById("filterMonth");
  const months = [...new Set(allData.map(d => d.date.substring(0,7)))].sort().reverse();
  const current = sel.value;
  sel.innerHTML = '<option value="all">전체 기간</option>';
  months.forEach(m => {
    const [y, mo] = m.split("-");
    sel.innerHTML += `<option value="${m}">${y}년 ${parseInt(mo)}월</option>`;
  });
  if (current) sel.value = current;
}

function renderHistory() {
  const typeFilter = document.getElementById("filterType").value;
  const monthFilter = document.getElementById("filterMonth").value;
  const list = document.getElementById("historyList");

  let filtered = allData.filter(d => {
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (monthFilter !== "all" && !d.date.startsWith(monthFilter)) return false;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">📭 기록이 없어요.<br>운동하고 첫 기록을 남겨보세요!</div>';
    return;
  }

  list.innerHTML = filtered.map(d => {
    const diff = d.weightDiff ?? (d.weightAfter - d.weightBefore);
    const diffText = diff < 0 ? `−${Math.abs(diff).toFixed(2)}` : `+${Math.abs(diff).toFixed(2)}`;
    const diffClass = diff > 0 ? "gain" : "";
    const typeText = d.type === "walking" ? "🚶 걷기" : "🏃 달리기";
    const typeIcon = d.type === "walking" ? "🚶" : "🏃";
    return `
      <div class="history-item ${d.type}">
        <div class="history-icon">${typeIcon}</div>
        <div class="history-info">
          <div class="history-date">${formatDate(d.date)}</div>
          <div class="history-type">${typeText}</div>
          <div class="history-stats">${d.duration}분 · ${d.distance || 0}km · 전 ${d.weightBefore}kg → 후 ${d.weightAfter}kg</div>
          ${d.memo ? `<div class="history-stats" style="margin-top:4px;font-style:italic;">${d.memo}</div>` : ""}
        </div>
        <div class="history-weight">
          <div class="history-weight-diff ${diffClass}">${diffText}</div>
          <div class="history-weight-label">kg 변화</div>
        </div>
        <button class="btn-delete" onclick="deleteRecord('${d.id}')">🗑️</button>
      </div>
    `;
  }).join("");
}

// 필터 변경 이벤트
document.getElementById("filterType").addEventListener("change", renderHistory);
document.getElementById("filterMonth").addEventListener("change", renderHistory);

// ===== 삭제 =====
window.deleteRecord = async function(id) {
  if (!confirm("이 기록을 삭제할까요?")) return;
  showLoading("삭제 중...");
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    allData = allData.filter(d => d.id !== id);
    updateFilterMonths();
    renderHistory();
    showToast("🗑️ 삭제되었습니다.");
  } catch(e) {
    showToast("❌ 삭제 실패!");
  } finally {
    hideLoading();
  }
};

// ===== 차트 =====
function renderCharts() {
  if (allData.length === 0) return;

  // 걷기/달리기 평균 체중 감소 계산
  const walkData = allData.filter(d => d.type === "walking");
  const runData = allData.filter(d => d.type === "running");

  const walkAvg = walkData.length > 0
    ? walkData.reduce((sum, d) => sum + (d.weightDiff ?? (d.weightAfter - d.weightBefore)), 0) / walkData.length
    : null;
  const runAvg = runData.length > 0
    ? runData.reduce((sum, d) => sum + (d.weightDiff ?? (d.weightAfter - d.weightBefore)), 0) / runData.length
    : null;

  document.getElementById("walkAvg").textContent = walkAvg !== null ? (walkAvg < 0 ? `${walkAvg.toFixed(2)}` : `+${walkAvg.toFixed(2)}`) : "-";
  document.getElementById("runAvg").textContent = runAvg !== null ? (runAvg < 0 ? `${runAvg.toFixed(2)}` : `+${runAvg.toFixed(2)}`) : "-";

  // 승자 배너
  const banner = document.getElementById("winnerBanner");
  const winnerText = document.getElementById("winnerText");
  if (walkAvg !== null && runAvg !== null) {
    banner.style.display = "block";
    if (walkAvg < runAvg) {
      winnerText.textContent = "🏆 걷기가 체중 감소에 더 효과적입니다!";
    } else if (runAvg < walkAvg) {
      winnerText.textContent = "🏆 달리기가 체중 감소에 더 효과적입니다!";
    } else {
      winnerText.textContent = "⚖️ 걷기와 달리기 효과가 동일합니다!";
    }
  }

  // 체중 변화 추이 차트
  const sorted = [...allData].sort((a,b) => a.date.localeCompare(b.date)).slice(-20);
  const labels = sorted.map(d => formatDate(d.date));
  const beforeWeights = sorted.map(d => d.weightBefore);
  const afterWeights = sorted.map(d => d.weightAfter);

  if (weightChart) weightChart.destroy();
  weightChart = new Chart(document.getElementById("weightChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "운동 전 체중",
          data: beforeWeights,
          borderColor: "#ff6b35",
          backgroundColor: "rgba(255,107,53,0.1)",
          tension: 0.4,
          pointRadius: 4,
        },
        {
          label: "운동 후 체중",
          data: afterWeights,
          borderColor: "#00e5ff",
          backgroundColor: "rgba(0,229,255,0.1)",
          tension: 0.4,
          pointRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#e8eaf0", font: { family: "Noto Sans KR" } } } },
      scales: {
        x: { ticks: { color: "#8b90a7", font: { size: 10 } }, grid: { color: "#2d3250" } },
        y: { ticks: { color: "#8b90a7" }, grid: { color: "#2d3250" } }
      }
    }
  });

  // 효율 비교 차트 (시간당 체중 감소)
  const walkEff = walkData.length > 0
    ? walkData.reduce((sum, d) => sum + Math.abs(d.weightDiff ?? (d.weightAfter - d.weightBefore)) / d.duration, 0) / walkData.length * 60
    : 0;
  const runEff = runData.length > 0
    ? runData.reduce((sum, d) => sum + Math.abs(d.weightDiff ?? (d.weightAfter - d.weightBefore)) / d.duration, 0) / runData.length * 60
    : 0;

  if (efficiencyChart) efficiencyChart.destroy();
  efficiencyChart = new Chart(document.getElementById("efficiencyChart"), {
    type: "bar",
    data: {
      labels: ["걷기 (시간당)", "달리기 (시간당)"],
      datasets: [{
        label: "체중 감소량 (kg/시간)",
        data: [walkEff.toFixed(3), runEff.toFixed(3)],
        backgroundColor: ["rgba(0,201,167,0.7)", "rgba(255,107,53,0.7)"],
        borderColor: ["#00c9a7", "#ff6b35"],
        borderWidth: 2,
        borderRadius: 8,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#e8eaf0", font: { family: "Noto Sans KR" } }, grid: { color: "#2d3250" } },
        y: { ticks: { color: "#8b90a7" }, grid: { color: "#2d3250" } }
      }
    }
  });

  // 운동 횟수 비교
  if (countChart) countChart.destroy();
  countChart = new Chart(document.getElementById("countChart"), {
    type: "doughnut",
    data: {
      labels: ["걷기", "달리기"],
      datasets: [{
        data: [walkData.length, runData.length],
        backgroundColor: ["rgba(0,201,167,0.8)", "rgba(255,107,53,0.8)"],
        borderColor: ["#00c9a7", "#ff6b35"],
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#e8eaf0", font: { family: "Noto Sans KR", size: 13 } }
        }
      }
    }
  });
}

// ===== AI 분석 =====
document.getElementById("btnAiAnalyze").addEventListener("click", async () => {
  if (allData.length < 3) {
    showToast("📊 최소 3개 이상의 기록이 필요합니다!");
    return;
  }

  showLoading("AI 분석 중...");
  const resultCard = document.getElementById("aiResultCard");
  const resultDiv = document.getElementById("aiResult");
  resultCard.style.display = "none";

  const walkData = allData.filter(d => d.type === "walking");
  const runData = allData.filter(d => d.type === "running");

  const walkAvg = walkData.length > 0
    ? (walkData.reduce((s, d) => s + (d.weightDiff ?? (d.weightAfter - d.weightBefore)), 0) / walkData.length).toFixed(3)
    : "없음";
  const runAvg = runData.length > 0
    ? (runData.reduce((s, d) => s + (d.weightDiff ?? (d.weightAfter - d.weightBefore)), 0) / runData.length).toFixed(3)
    : "없음";

  const totalDays = allData.length;
  const recentWeight = allData[0]?.weightAfter ?? "-";
  const firstWeight = allData[allData.length-1]?.weightBefore ?? "-";
  const totalChange = (recentWeight - firstWeight).toFixed(2);

  const prompt = `당신은 운동 및 체중 관리 전문가입니다. 아래 운동 데이터를 분석해주세요.

[데이터 요약]
- 총 운동 횟수: ${totalDays}회
- 걷기 횟수: ${walkData.length}회, 회당 평균 체중 변화: ${walkAvg}kg
- 달리기 횟수: ${runData.length}회, 회당 평균 체중 변화: ${runAvg}kg
- 첫 기록 체중: ${firstWeight}kg
- 최근 체중: ${recentWeight}kg
- 전체 기간 체중 변화: ${totalChange}kg

위 데이터를 바탕으로 한국어로:
1. 걷기 vs 달리기 중 어느 것이 체중 감소에 더 효과적인지
2. 전반적인 운동 패턴 평가
3. 앞으로의 운동 방향 추천

간결하고 실용적으로 답변해주세요. 이모지를 적절히 사용해주세요.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text ?? "분석 결과를 가져오지 못했습니다.";
    resultDiv.textContent = text;
    resultCard.style.display = "block";
  } catch(e) {
    showToast("❌ AI 분석 실패! 네트워크를 확인해주세요.");
  } finally {
    hideLoading();
  }
});

// ===== 초기화 =====
setHeaderDate();
initTabs();
initRecordForm();
showLoading("데이터 불러오는 중...");
loadData().then(() => {
  hideLoading();
  renderHistory();
});
