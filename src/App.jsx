import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Leaf, Plus, Check, Sparkles, CalendarClock, ListTodo, Settings2, X, Clock,
  Inbox as InboxIcon, ArrowRight, Timer, Flame, Filter, Trash2, Undo2,
  TrendingUp, Download, Moon, FolderKanban, Hourglass,
} from "lucide-react";

// ---------- ユーティリティ ----------
const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (dateStr, n) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmtJP = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};
const uid = () => Math.random().toString(36).slice(2, 10);
const STORAGE_KEY = "habit-app-state-v2";

const storage = {
  get: async (key) => {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? { key, value: v } : null;
    } catch (e) {
      return null;
    }
  },
  set: async (key, value) => {
    try {
      localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  },
};

const DEFAULT_ITEMS = [
  { id: uid(), title: "資料をまとめる", status: "calendar", dueDate: todayStr(), time: "15:00", done: false, createdAt: todayStr() },
  { id: uid(), title: "本を返しに行くのを頼まれた件、返事待ち", status: "waiting", done: false, createdAt: addDays(todayStr(), -9) },
  { id: uid(), title: "引っ越し先を決める", status: "someday", done: false, createdAt: todayStr() },
];

const DEFAULT_HABITS = [
  { id: uid(), title: "読書", minimalAction: "1ページだけ読む", stackTrigger: "夜、歯を磨いた直後に", time: "22:00", frequency: { type: "daily" }, history: {} },
  { id: uid(), title: "瞑想", minimalAction: "1分だけ目を閉じる", stackTrigger: "朝コーヒーを淹れた直後に", time: "07:30", frequency: { type: "weekly", days: [1, 3, 5] }, history: {} },
];

function isScheduledOn(habit, dateStr) {
  if (habit.pauseDates && habit.pauseDates.includes(dateStr)) return false;
  const freq = habit.frequency;
  if (!freq || freq.type === "daily") return true;
  if (freq.type === "weekly") {
    if (!freq.days || freq.days.length === 0) return false;
    return freq.days.includes(new Date(dateStr).getDay());
  }
  return true;
}
function dateRange(from, to) {
  const out = [];
  let d = from;
  let guard = 0;
  while (d <= to && guard < 366) {
    out.push(d);
    d = addDays(d, 1);
    guard++;
  }
  return out;
}
function habitWeeklyRate(habit, ref = todayStr()) {
  let scheduled = 0;
  let achieved = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ref, -i);
    if (!isScheduledOn(habit, d)) continue;
    scheduled++;
    const s = habit.history[d];
    if (s === "done" || s === "minimal") achieved++;
  }
  if (scheduled === 0) return null;
  return Math.round((achieved / scheduled) * 100);
}
function frequencyLabel(habit) {
  const freq = habit.frequency;
  if (!freq || freq.type === "daily") return "毎日";
  if (freq.type === "weekly") {
    const names = ["日", "月", "火", "水", "木", "金", "土"];
    if (!freq.days || freq.days.length === 0) return "未設定";
    return freq.days.slice().sort().map((d) => names[d]).join("・");
  }
  return "毎日";
}

function habitStatus(habit, ref = todayStr()) {
  const recent = [];
  let d = addDays(ref, -1);
  let guard = 0;
  while (recent.length < 2 && guard < 30) {
    if (isScheduledOn(habit, d)) recent.push(d);
    d = addDays(d, -1);
    guard++;
  }
  if (recent.length < 2) return "ok";
  const missed = recent.every((dt) => !habit.history[dt] || habit.history[dt] === "missed");
  return missed ? "nudge" : "ok";
}
function leafRow(habit, ref = todayStr()) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(ref, -i);
    const scheduled = isScheduledOn(habit, d);
    days.push({ date: d, status: scheduled ? habit.history[d] || null : "skip" });
  }
  return days;
}
const leafColor = (s) => (s === "done" ? "#6E9A5E" : s === "minimal" ? "#D9A94A" : s === "missed" ? "#C9C4B5" : s === "skip" ? "#F0EEE5" : "#E4E2D8");

export default function HabitApp() {
  const [tab, setTab] = useState("focus");
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [habits, setHabits] = useState(DEFAULT_HABITS);
  const [frogCount, setFrogCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [wizardActive, setWizardActive] = useState(false);
  const [reviewActive, setReviewActive] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (parsed.items) setItems(parsed.items);
          if (parsed.habits) setHabits(parsed.habits);
          if (typeof parsed.frogCount === "number") setFrogCount(parsed.frogCount);
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await storage.set(STORAGE_KEY, JSON.stringify({ items, habits, frogCount }));
      } catch (e) {
        console.error("保存に失敗しました", e);
      }
    })();
  }, [items, habits, frogCount, loaded]);

  const updateItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);
  const deleteItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);
  const addItem = useCallback((patch) => {
    setItems((prev) => [...prev, { id: uid(), done: false, createdAt: todayStr(), ...patch }]);
  }, []);
  const addInboxItem = useCallback((title) => {
    if (!title.trim()) return;
    addItem({ title: title.trim(), status: "inbox" });
  }, [addItem]);
  const convertToHabit = useCallback((item, form) => {
    setHabits((prev) => [...prev, { id: uid(), title: item.title, minimalAction: form.minimalAction, stackTrigger: form.stackTrigger, time: form.time, frequency: form.frequency || { type: "daily" }, pauseDates: [], history: {} }]);
    deleteItem(item.id);
  }, [deleteItem]);
  const markHabit = useCallback((id, status) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, history: { ...h.history, [todayStr()]: status } } : h)));
  }, []);
  const updateHabit = useCallback((id, patch) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  }, []);
  const addHabitDirect = useCallback((habit) => {
    setHabits((prev) => [...prev, { ...habit, id: uid(), pauseDates: [], history: {} }]);
    setShowAddHabit(false);
  }, []);
  const setFrog = useCallback((id) => {
    setItems((prev) => prev.map((it) => ({ ...it, isFrog: it.id === id })));
  }, []);
  const eatFrog = useCallback((id) => {
    updateItem(id, { done: true });
    setFrogCount((n) => n + 1);
  }, [updateItem]);

  const inboxCount = items.filter((i) => i.status === "inbox").length;

  return (
    <div className="min-h-screen w-full" style={{ background: "#F5F6F1", color: "#2B3328" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        .font-display { font-family: 'Zen Maru Gothic', sans-serif; }
        .font-body { font-family: 'Noto Sans JP', sans-serif; }
      `}</style>

      <div className="max-w-md mx-auto pb-24 font-body">
        <header className="px-5 pt-8 pb-4">
          <div className="flex items-center gap-2 text-[#6E9A5E]">
            <Leaf size={20} />
            <span className="font-display text-sm tracking-wide">そだつ</span>
          </div>
          <h1 className="font-display text-2xl mt-1">{fmtJP(todayStr())}のページ</h1>
          <p className="text-xs mt-1" style={{ color: "#8A9284" }}>突っ込む→仕分ける→実行する。</p>
        </header>

        {wizardActive ? (
          <SortWizard
            items={items}
            updateItem={updateItem}
            convertToHabit={convertToHabit}
            onExit={() => setWizardActive(false)}
          />
        ) : reviewActive ? (
          <ReviewWizard items={items} updateItem={updateItem} deleteItem={deleteItem} onExit={() => setReviewActive(false)} />
        ) : (
          <>
            {tab === "focus" && (
              <FocusView items={items} updateItem={updateItem} setFrog={setFrog} eatFrog={eatFrog} habits={habits} markHabit={markHabit} />
            )}
            {tab === "inbox" && (
              <InboxView
                items={items}
                addInboxItem={addInboxItem}
                updateItem={updateItem}
                deleteItem={deleteItem}
                addItem={addItem}
                inboxCount={inboxCount}
                onStartWizard={() => setWizardActive(true)}
                onStartReview={() => setReviewActive(true)}
              />
            )}
            {tab === "habits" && <HabitsView habits={habits} onAdd={() => setShowAddHabit(true)} updateHabit={updateHabit} frogCount={frogCount} />}
            {tab === "schedule" && <ScheduleView items={items} habits={habits} updateItem={updateItem} />}
          </>
        )}
      </div>

      {showAddHabit && <AddHabitModal onClose={() => setShowAddHabit(false)} onSave={addHabitDirect} />}

      {!wizardActive && !reviewActive && (
        <nav className="fixed bottom-0 left-0 right-0 border-t" style={{ background: "#FFFFFF", borderColor: "#E4E2D8" }}>
          <div className="max-w-md mx-auto flex justify-around py-2">
            <NavButton icon={<ListTodo size={20} />} label="今日" active={tab === "focus"} onClick={() => setTab("focus")} />
            <NavButton
              icon={<InboxIcon size={20} />}
              label="Inbox"
              badge={inboxCount}
              active={tab === "inbox"}
              onClick={() => setTab("inbox")}
            />
            <NavButton icon={<Sparkles size={20} />} label="習慣" active={tab === "habits"} onClick={() => setTab("habits")} />
            <NavButton icon={<CalendarClock size={20} />} label="予定" active={tab === "schedule"} onClick={() => setTab("schedule")} />
          </div>
        </nav>
      )}
    </div>
  );
}

function NavButton({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className="relative flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl" style={{ color: active ? "#6E9A5E" : "#A8ACA0" }}>
      {icon}
      {badge > 0 && (
        <span className="absolute -top-0.5 right-2 text-[9px] rounded-full w-4 h-4 flex items-center justify-center" style={{ background: "#C97B63", color: "#fff" }}>
          {badge}
        </span>
      )}
      <span className="text-[10px] font-display">{label}</span>
    </button>
  );
}

function FocusView({ items, updateItem, setFrog, eatFrog, habits, markHabit }) {
  const [onlyShort, setOnlyShort] = useState(false);

  const frog = items.find((i) => i.isFrog && i.status === "next" && !i.done);
  const calendarToday = items
    .filter((i) => i.status === "calendar" && i.dueDate === todayStr() && !i.done)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  let nextActions = items.filter((i) => i.status === "next" && !i.done && !i.isFrog);
  if (onlyShort) nextActions = nextActions.filter((i) => i.durationMin === 5);

  return (
    <div className="px-5 space-y-6">
      <section>
        {frog ? (
          <div className="rounded-2xl p-4" style={{ background: "#2B3328" }}>
            <p className="text-[10px] font-display flex items-center gap-1" style={{ color: "#C9E0BE" }}>
              <Flame size={12} /> 今日のカエル（最優先タスク）
            </p>
            <p className="font-display text-base mt-1" style={{ color: "#fff" }}>{frog.title}</p>
            <button
              onClick={() => eatFrog(frog.id)}
              className="mt-3 rounded-xl px-4 py-2 text-xs font-display"
              style={{ background: "#6E9A5E", color: "#fff" }}
            >
              食べた（完了）
            </button>
          </div>
        ) : (
          <FrogPicker candidates={items.filter((i) => i.status === "next" && !i.done)} onPick={setFrog} />
        )}
      </section>

      {calendarToday.length > 0 && (
        <section>
          <h2 className="font-display text-sm mb-2" style={{ color: "#8A9284" }}>今日の予定</h2>
          <div className="space-y-2">
            {calendarToday.map((t) => (
              <ItemRow key={t.id} item={t} onToggle={() => updateItem(t.id, { done: !t.done })} showTime />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-sm mb-2" style={{ color: "#8A9284" }}>今日の習慣</h2>
        <div className="space-y-3">
          {habits.filter((h) => isScheduledOn(h, todayStr())).map((h) => (
            <HabitCard key={h.id} habit={h} onMark={markHabit} />
          ))}
          {habits.filter((h) => isScheduledOn(h, todayStr())).length === 0 && (
            <p className="text-xs" style={{ color: "#B4B8AA" }}>今日予定されている習慣はありません。</p>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-sm" style={{ color: "#8A9284" }}>Next Action</h2>
          <button
            onClick={() => setOnlyShort((v) => !v)}
            className="flex items-center gap-1 text-[11px] rounded-full px-2 py-1"
            style={{ background: onlyShort ? "#6E9A5E" : "#EFEDE3", color: onlyShort ? "#fff" : "#8A9284" }}
          >
            <Filter size={11} /> 5分以内だけ
          </button>
        </div>
        {nextActions.length === 0 && <p className="text-xs" style={{ color: "#B4B8AA" }}>今すぐやるタスクはありません。</p>}
        <div className="space-y-2">
          {nextActions.map((t) => (
            <ItemRow key={t.id} item={t} onToggle={() => updateItem(t.id, { done: !t.done })} />
          ))}
        </div>
      </section>

      <p className="text-[11px] text-center pt-2" style={{ color: "#B4B8AA" }}>
        Waiting・Project・SomedayはInboxタブから確認できます。この画面には出しません。
      </p>
    </div>
  );
}

function FrogPicker({ candidates, onPick }) {
  const [open, setOpen] = useState(false);
  if (candidates.length === 0) {
    return <p className="text-xs" style={{ color: "#B4B8AA" }}>Next Actionが増えたら「今日のカエル」を選べます。</p>;
  }
  return (
    <div className="rounded-2xl p-4" style={{ background: "#FFFFFF", border: "1px dashed #C9C4B5" }}>
      {!open ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm font-display" style={{ color: "#6E9A5E" }}>
          <Flame size={16} /> 今日のカエルを選ぶ
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px]" style={{ color: "#8A9284" }}>今日、最も重要で気が重いタスクを1つ選んでください</p>
          {candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => { onPick(c.id); setOpen(false); }}
              className="w-full text-left text-sm rounded-lg px-3 py-2"
              style={{ background: "#F5F6F1" }}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, onToggle, showTime }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
      <button
        onClick={onToggle}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ background: item.done ? "#6E9A5E" : "transparent", border: item.done ? "none" : "1.5px solid #C9C4B5" }}
      >
        {item.done && <Check size={12} color="#fff" />}
      </button>
      <span className={`text-sm flex-1 ${item.done ? "line-through" : ""}`} style={{ color: item.done ? "#B4B8AA" : "#2B3328" }}>
        {item.title}
      </span>
      {item.durationMin === 5 && (
        <span className="text-[10px] rounded-full px-2 py-0.5" style={{ background: "#F5EEDB", color: "#B5872F" }}>5分</span>
      )}
      {showTime && item.time && (
        <span className="text-[11px] flex items-center gap-1" style={{ color: "#8A9284" }}><Clock size={11} /> {item.time}</span>
      )}
    </div>
  );
}

function HabitCard({ habit, onMark }) {
  const status = habitStatus(habit);
  const doneToday = habit.history[todayStr()];
  return (
    <div className="rounded-2xl p-4" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-sm">{habit.title}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#6E9A5E" }}>{frequencyLabel(habit)}</p>
          {habit.stackTrigger && <p className="text-[11px] mt-0.5" style={{ color: "#A8ACA0" }}>{habit.stackTrigger}</p>}
        </div>
        <div className="flex gap-1">
          {leafRow(habit).map((d, i) => (
            <Leaf key={i} size={13} color={leafColor(d.status)} fill={leafColor(d.status)} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onMark(habit.id, "done")}
          disabled={doneToday === "done"}
          className="flex-1 rounded-xl py-2 text-xs font-display"
          style={{ background: doneToday === "done" ? "#E9F1E4" : "#6E9A5E", color: doneToday === "done" ? "#6E9A5E" : "#FFFFFF" }}
        >
          {doneToday === "done" ? "完了ずみ" : "完了にする"}
        </button>
        <button
          onClick={() => onMark(habit.id, "minimal")}
          disabled={doneToday === "minimal"}
          className="rounded-xl py-2 px-3 text-xs font-display"
          style={{ background: doneToday === "minimal" ? "#FBF1DD" : "#F5EEDB", color: "#B5872F" }}
        >
          {habit.minimalAction || "最小版だけ"}
        </button>
      </div>
      {status === "nudge" && (
        <p className="text-[11px] mt-2 rounded-lg px-2 py-1.5" style={{ background: "#FBEFE9", color: "#B57259" }}>
          2日お休み中みたい。無理せず、今日は「{habit.minimalAction || "最小版"}」だけでも大丈夫。
        </p>
      )}
    </div>
  );
}

function elapsedDays(dateStr, ref = todayStr()) {
  const ms = new Date(ref) - new Date(dateStr);
  return Math.floor(ms / 86400000);
}

function InboxView({ items, addInboxItem, updateItem, deleteItem, addItem, inboxCount, onStartWizard, onStartReview }) {
  const [text, setText] = useState("");
  const [segment, setSegment] = useState("inbox");
  const [openProjectId, setOpenProjectId] = useState(null);
  const list = items.filter((i) => i.status === segment);
  const openProject = items.find((i) => i.id === openProjectId);
  const reviewCount = items.filter((i) => ["someday", "waiting", "project"].includes(i.status)).length;

  const exportData = () => {
    const payload = JSON.stringify({ exportedAt: todayStr(), items }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sodatsu-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-5 space-y-4">
      <div className="rounded-2xl p-3 flex items-center gap-2" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { addInboxItem(text); setText(""); } }}
          placeholder="思いついたことを何でも入力"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#B4B8AA]"
        />
        <button
          onClick={() => { addInboxItem(text); setText(""); }}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "#6E9A5E", color: "#FFFFFF" }}
        >
          <Plus size={16} />
        </button>
      </div>

      {inboxCount > 0 && (
        <button
          onClick={onStartWizard}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm"
          style={{ background: "#6E9A5E", color: "#fff" }}
        >
          仕分けを始める（{inboxCount}件） <ArrowRight size={16} />
        </button>
      )}

      {reviewCount > 0 && (
        <button
          onClick={onStartReview}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm"
          style={{ background: "#FFFFFF", border: "1px solid #6E9A5E", color: "#4E7A44" }}
        >
          <TrendingUp size={15} /> 週次レビューを始める（{reviewCount}件）
        </button>
      )}

      <div className="flex gap-2 flex-wrap">
        {[
          ["inbox", "Inbox"],
          ["waiting", "対応待ち"],
          ["project", "プロジェクト"],
          ["someday", "いつか"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSegment(key)}
            className="text-[11px] font-display rounded-full px-3 py-1.5"
            style={{ background: segment === key ? "#2B3328" : "#EFEDE3", color: segment === key ? "#fff" : "#8A9284" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.length === 0 && <p className="text-xs" style={{ color: "#B4B8AA" }}>ここには何もありません。</p>}
        {list.map((it) => {
          const days = it.createdAt ? elapsedDays(it.createdAt) : 0;
          const isStale = segment === "waiting" && days >= 7;
          return (
            <div
              key={it.id}
              onClick={() => segment === "project" && setOpenProjectId(it.id)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "#FFFFFF", border: isStale ? "1px solid #E3B29E" : "1px solid #E4E2D8", cursor: segment === "project" ? "pointer" : "default" }}
            >
              <span className="text-sm flex-1">{it.title}</span>
              {segment === "waiting" && (
                <span className="text-[10px] rounded-full px-2 py-0.5 flex items-center gap-1" style={{ background: isStale ? "#FBEFE9" : "#EFEDE3", color: isStale ? "#B57259" : "#8A9284" }}>
                  <Hourglass size={10} /> {days}日経過
                </span>
              )}
              {segment === "project" && (
                <span className="text-[10px] rounded-full px-2 py-0.5" style={{ background: "#EFEDE3", color: "#8A9284" }}>
                  {(it.subtasks || []).filter((s) => !s.done).length}件未完了
                </span>
              )}
              {segment !== "inbox" && (
                <button onClick={(e) => { e.stopPropagation(); updateItem(it.id, { status: "inbox" }); }} title="Inboxに戻す">
                  <Undo2 size={15} color="#8A9284" />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); deleteItem(it.id); }} title="削除">
                <Trash2 size={15} color="#C9A99A" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={exportData}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-display"
        style={{ background: "#EFEDE3", color: "#8A9284" }}
      >
        <Download size={13} /> データをバックアップ（JSON）
      </button>

      {openProject && (
        <ProjectDetailModal
          project={openProject}
          onClose={() => setOpenProjectId(null)}
          updateItem={updateItem}
          addItem={addItem}
        />
      )}
    </div>
  );
}

function ProjectDetailModal({ project, onClose, updateItem, addItem }) {
  const [subtaskText, setSubtaskText] = useState("");
  const subtasks = project.subtasks || [];

  const addSubtask = () => {
    if (!subtaskText.trim()) return;
    updateItem(project.id, { subtasks: [...subtasks, { id: uid(), title: subtaskText.trim(), done: false, sent: false }] });
    setSubtaskText("");
  };
  const toggleSubtask = (id) => {
    updateItem(project.id, { subtasks: subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) });
  };
  const deleteSubtask = (id) => {
    updateItem(project.id, { subtasks: subtasks.filter((s) => s.id !== id) });
  };
  const sendToNext = (s) => {
    addItem({ title: s.title, status: "next" });
    updateItem(project.id, { subtasks: subtasks.map((x) => (x.id === s.id ? { ...x, sent: true } : x)) });
  };

  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ background: "rgba(43,51,40,0.4)" }}>
      <div className="w-full max-w-md rounded-t-3xl p-5 font-body max-h-[80vh] overflow-y-auto" style={{ background: "#F5F6F1" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderKanban size={16} color="#6E9A5E" />
            <h3 className="font-display text-base">{project.title}</h3>
          </div>
          <button onClick={onClose}><X size={18} color="#8A9284" /></button>
        </div>

        <p className="text-[11px] mb-2" style={{ color: "#8A9284" }}>次の一歩を分解しましょう</p>
        <div className="rounded-2xl p-2 flex items-center gap-2 mb-3" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
          <input
            value={subtaskText}
            onChange={(e) => setSubtaskText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubtask()}
            placeholder="次の一歩を追加"
            className="flex-1 bg-transparent outline-none text-sm px-1"
          />
          <button onClick={addSubtask} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#6E9A5E", color: "#fff" }}>
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-2">
          {subtasks.length === 0 && <p className="text-xs" style={{ color: "#B4B8AA" }}>まだ一歩も追加されていません。</p>}
          {subtasks.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
              <button
                onClick={() => toggleSubtask(s.id)}
                className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                style={{ background: s.done ? "#6E9A5E" : "transparent", border: s.done ? "none" : "1.5px solid #C9C4B5" }}
              >
                {s.done && <Check size={10} color="#fff" />}
              </button>
              <span className={`text-sm flex-1 ${s.done ? "line-through" : ""}`} style={{ color: s.done ? "#B4B8AA" : "#2B3328" }}>{s.title}</span>
              {!s.sent && !s.done && (
                <button onClick={() => sendToNext(s)} className="text-[10px] rounded-full px-2 py-1" style={{ background: "#E9F1E4", color: "#4E7A44" }}>
                  Next Actionへ
                </button>
              )}
              {s.sent && <span className="text-[10px]" style={{ color: "#A8ACA0" }}>送信済み</span>}
              <button onClick={() => deleteSubtask(s.id)}><Trash2 size={13} color="#C9A99A" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewWizard({ items, updateItem, deleteItem, onExit }) {
  const [skipped, setSkipped] = useState([]);
  const queue = items.filter((i) => ["someday", "waiting", "project"].includes(i.status) && !skipped.includes(i.id));
  const current = queue[0];
  const labelOf = { someday: "いつか", waiting: "対応待ち", project: "プロジェクト" };

  if (!current) {
    return (
      <div className="px-5 py-16 text-center">
        <TrendingUp className="mx-auto mb-3" color="#6E9A5E" />
        <p className="font-display text-sm">レビュー完了！リストがすっきりしました。</p>
        <button onClick={onExit} className="mt-5 rounded-xl px-5 py-2.5 font-display text-sm" style={{ background: "#6E9A5E", color: "#fff" }}>
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="px-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px]" style={{ color: "#8A9284" }}>残り {queue.length} 件</p>
        <button onClick={onExit} className="text-[11px] flex items-center gap-1" style={{ color: "#8A9284" }}><X size={13} />中断</button>
      </div>

      <div className="rounded-2xl p-5 mb-4" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
        <span className="text-[10px] rounded-full px-2 py-0.5" style={{ background: "#EFEDE3", color: "#8A9284" }}>{labelOf[current.status]}</span>
        <p className="font-display text-base mt-2">{current.title}</p>
        {current.createdAt && (
          <p className="text-[11px] mt-1" style={{ color: "#A8ACA0" }}>{elapsedDays(current.createdAt)}日前に登録</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={() => updateItem(current.id, { status: "next" })}
          className="rounded-xl py-3 text-sm font-display"
          style={{ background: "#6E9A5E", color: "#fff" }}
        >
          今やる（Next Actionへ）
        </button>
        <button
          onClick={() => setSkipped((prev) => [...prev, current.id])}
          className="rounded-xl py-3 text-sm font-display"
          style={{ background: "#EFEDE3", color: "#8A9284" }}
        >
          そのままにする
        </button>
        <button
          onClick={() => deleteItem(current.id)}
          className="rounded-xl py-3 text-sm font-display"
          style={{ background: "#FBEFE9", color: "#B57259" }}
        >
          もう不要（削除）
        </button>
      </div>
    </div>
  );
}

function SortWizard({ items, updateItem, convertToHabit, onExit }) {
  const inbox = items.filter((i) => i.status === "inbox");
  const current = inbox[0];
  const [step, setStep] = useState("q1");
  const [habitForm, setHabitForm] = useState({ minimalAction: "", stackTrigger: "", time: "", frequency: { type: "daily" } });
  const [calDate, setCalDate] = useState(todayStr());
  const [calTime, setCalTime] = useState("");
  const [seconds, setSeconds] = useState(120);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setStep("q1");
    setHabitForm({ minimalAction: "", stackTrigger: "", time: "", frequency: { type: "daily" } });
    setCalDate(todayStr());
    setCalTime("");
    setSeconds(120);
    setRunning(false);
  }, [current?.id]);

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, seconds]);

  if (!current) {
    return (
      <div className="px-5 py-16 text-center">
        <Sparkles className="mx-auto mb-3" color="#6E9A5E" />
        <p className="font-display text-sm">Inboxは空っぽです。仕分け完了！</p>
        <button onClick={onExit} className="mt-5 rounded-xl px-5 py-2.5 font-display text-sm" style={{ background: "#6E9A5E", color: "#fff" }}>
          Focus画面へ戻る
        </button>
      </div>
    );
  }

  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="px-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px]" style={{ color: "#8A9284" }}>残り {inbox.length} 件</p>
        <button onClick={onExit} className="text-[11px] flex items-center gap-1" style={{ color: "#8A9284" }}><X size={13} />中断</button>
      </div>

      <div className="rounded-2xl p-5 mb-4" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
        <p className="text-[11px] mb-1" style={{ color: "#A8ACA0" }}>仕分け中のタスク</p>
        <p className="font-display text-base">{current.title}</p>
      </div>

      {step === "q1" && (
        <WizardQuestion
          question="これは繰り返し行う習慣？"
          onYes={() => setStep("habitForm")}
          onNo={() => setStep("q2")}
        />
      )}

      {step === "habitForm" && (
        <div className="space-y-3">
          <FrequencyPicker value={habitForm.frequency} onChange={(f) => setHabitForm({ ...habitForm, frequency: f })} />
          <Field label="最小実行版（レイジーデイ用）" value={habitForm.minimalAction} onChange={(v) => setHabitForm({ ...habitForm, minimalAction: v })} placeholder="例: 1分だけやる" />
          <Field label="ハビット・スタッキング（任意）" value={habitForm.stackTrigger} onChange={(v) => setHabitForm({ ...habitForm, stackTrigger: v })} placeholder="例: 朝コーヒーの直後に" />
          <Field label="目安時刻（任意）" value={habitForm.time} onChange={(v) => setHabitForm({ ...habitForm, time: v })} placeholder="例: 22:00" />
          <button
            onClick={() => convertToHabit(current, habitForm)}
            className="w-full rounded-xl py-3 font-display text-sm"
            style={{ background: "#6E9A5E", color: "#fff" }}
          >
            習慣として保存する
          </button>
        </div>
      )}

      {step === "q2" && (
        <WizardQuestion question="今やるべき？" onYes={() => setStep("q3")} onNo={() => updateItem(current.id, { status: "someday" })} />
      )}

      {step === "q3" && (
        <WizardQuestion question="手順が複数ある？" onYes={() => updateItem(current.id, { status: "project" })} onNo={() => setStep("q4")} />
      )}

      {step === "q4" && (
        <WizardQuestion question="自分以外の対応待ち？" onYes={() => updateItem(current.id, { status: "waiting" })} onNo={() => setStep("q5")} />
      )}

      {step === "q5" && (
        <WizardQuestion question="日時が決まってる？" onYes={() => setStep("q5-date")} onNo={() => setStep("q6")} />
      )}

      {step === "q5-date" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {[["今日", todayStr()], ["明日", addDays(todayStr(), 1)], ["明後日", addDays(todayStr(), 2)]].map(([label, d]) => (
              <button
                key={label}
                onClick={() => setCalDate(d)}
                className="flex-1 rounded-xl py-2 text-xs font-display"
                style={{ background: calDate === d ? "#2B3328" : "#EFEDE3", color: calDate === d ? "#fff" : "#8A9284" }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-[11px]" style={{ color: "#8A9284" }}>日付を直接選ぶ</span>
            <input
              type="date"
              value={calDate}
              onChange={(e) => setCalDate(e.target.value)}
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}
            />
          </label>
          <Field label="時刻（任意）" value={calTime} onChange={setCalTime} placeholder="例: 15:00" />
          <button
            onClick={() => updateItem(current.id, { status: "calendar", dueDate: calDate, time: calTime })}
            className="w-full rounded-xl py-3 font-display text-sm"
            style={{ background: "#6E9A5E", color: "#fff" }}
          >
            カレンダーに入れる
          </button>
        </div>
      )}

      {step === "q6" && (
        <WizardQuestion question="2分以内にできる？" onYes={() => setStep("timer")} onNo={() => setStep("duration")} />
      )}

      {step === "timer" && (
        <div className="rounded-2xl p-6 text-center" style={{ background: "#2B3328" }}>
          <Timer className="mx-auto mb-2" color="#C9E0BE" size={20} />
          <p className="font-display text-3xl" style={{ color: "#fff" }}>{mm}:{ss}</p>
          <p className="text-[11px] mt-1" style={{ color: "#9EB596" }}>今すぐ2分だけやってみましょう</p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setRunning((r) => !r)} className="flex-1 rounded-xl py-2 text-xs font-display" style={{ background: "#6E9A5E", color: "#fff" }}>
              {running ? "一時停止" : "スタート"}
            </button>
            <button
              onClick={() => updateItem(current.id, { done: true, status: "next" })}
              className="flex-1 rounded-xl py-2 text-xs font-display"
              style={{ background: "#4E7A44", color: "#fff" }}
            >
              完了した
            </button>
          </div>
          <button onClick={() => setStep("duration")} className="mt-3 text-[11px]" style={{ color: "#9EB596" }}>
            今は無理そう → Next Actionへ
          </button>
        </div>
      )}

      {step === "duration" && (
        <WizardQuestion
          question="所要時間の目安は？"
          yesLabel="5分以内"
          noLabel="それ以上"
          onYes={() => updateItem(current.id, { status: "next", durationMin: 5 })}
          onNo={() => updateItem(current.id, { status: "next", durationMin: null })}
        />
      )}
    </div>
  );
}

function WizardQuestion({ question, onYes, onNo, yesLabel = "YES", noLabel = "NO" }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
      <p className="font-display text-sm mb-4">{question}</p>
      <div className="flex gap-2">
        <button onClick={onNo} className="flex-1 rounded-xl py-2.5 text-xs font-display" style={{ background: "#EFEDE3", color: "#8A9284" }}>{noLabel}</button>
        <button onClick={onYes} className="flex-1 rounded-xl py-2.5 text-xs font-display" style={{ background: "#6E9A5E", color: "#fff" }}>{yesLabel}</button>
      </div>
    </div>
  );
}

function HabitsView({ habits, onAdd, updateHabit, frogCount }) {
  const rates = habits.map((h) => habitWeeklyRate(h)).filter((r) => r !== null);
  const avgRate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;

  return (
    <div className="px-5 space-y-4">
      <div className="rounded-2xl p-4" style={{ background: "#2B3328" }}>
        <p className="text-[10px] font-display" style={{ color: "#C9E0BE" }}>今週の振り返り</p>
        <div className="flex items-center justify-between mt-2">
          <div>
            <p className="text-[11px]" style={{ color: "#9EB596" }}>習慣の達成率</p>
            <p className="font-display text-xl" style={{ color: "#fff" }}>{avgRate === null ? "―" : `${avgRate}%`}</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: "#9EB596" }}>カエルを食べた回数</p>
            <p className="font-display text-xl text-right" style={{ color: "#fff" }}>{frogCount}回</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm" style={{ color: "#8A9284" }}>登録中の習慣</h2>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-display rounded-full px-3 py-1.5" style={{ background: "#6E9A5E", color: "#fff" }}>
          <Plus size={13} /> 追加
        </button>
      </div>
      {habits.map((h) => (
        <HabitManageCard key={h.id} habit={h} updateHabit={updateHabit} />
      ))}
    </div>
  );
}

function HabitManageCard({ habit, updateHabit }) {
  const [showPause, setShowPause] = useState(false);
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const totalDone = Object.values(habit.history).filter((s) => s === "done" || s === "minimal").length;
  const rate = habitWeeklyRate(habit);
  const pauseCount = (habit.pauseDates || []).length;

  const applyPause = () => {
    const range = dateRange(from, to);
    const merged = Array.from(new Set([...(habit.pauseDates || []), ...range]));
    updateHabit(habit.id, { pauseDates: merged });
    setShowPause(false);
  };
  const clearPause = () => updateHabit(habit.id, { pauseDates: [] });

  return (
    <div className="rounded-2xl p-4" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
      <div className="flex items-center justify-between">
        <p className="font-display text-sm">{habit.title}</p>
        {rate !== null && (
          <span className="text-[10px] rounded-full px-2 py-0.5" style={{ background: "#E9F1E4", color: "#4E7A44" }}>週{rate}%</span>
        )}
      </div>
      <p className="text-[11px] mt-0.5" style={{ color: "#6E9A5E" }}>{frequencyLabel(habit)}</p>
      <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]" style={{ color: "#8A9284" }}>
        <div><Settings2 size={11} className="inline mr-1" />最小版: {habit.minimalAction || "未設定"}</div>
        <div><Clock size={11} className="inline mr-1" />目安時刻: {habit.time || "未設定"}</div>
      </div>
      {habit.stackTrigger && <p className="text-[11px] mt-1" style={{ color: "#A8ACA0" }}>スタッキング: {habit.stackTrigger}</p>}
      <p className="text-[11px] mt-1" style={{ color: "#A8ACA0" }}>累計達成日数: {totalDone}日</p>

      <div className="flex items-center justify-between mt-3">
        <button onClick={() => setShowPause((v) => !v)} className="flex items-center gap-1 text-[11px]" style={{ color: "#8A9284" }}>
          <Moon size={12} /> お休みを設定{pauseCount > 0 ? `（${pauseCount}日設定中）` : ""}
        </button>
        {pauseCount > 0 && (
          <button onClick={clearPause} className="text-[11px]" style={{ color: "#C97B63" }}>クリア</button>
        )}
      </div>

      {showPause && (
        <div className="mt-2 space-y-2 rounded-xl p-3" style={{ background: "#F5F6F1" }}>
          <div className="flex gap-2">
            <label className="flex-1 block">
              <span className="text-[10px]" style={{ color: "#8A9284" }}>から</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full mt-1 rounded-lg px-2 py-1.5 text-xs outline-none" style={{ background: "#fff", border: "1px solid #E4E2D8" }} />
            </label>
            <label className="flex-1 block">
              <span className="text-[10px]" style={{ color: "#8A9284" }}>まで</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full mt-1 rounded-lg px-2 py-1.5 text-xs outline-none" style={{ background: "#fff", border: "1px solid #E4E2D8" }} />
            </label>
          </div>
          <button onClick={applyPause} className="w-full rounded-xl py-2 text-xs font-display" style={{ background: "#6E9A5E", color: "#fff" }}>
            この期間をお休みにする
          </button>
          <p className="text-[10px]" style={{ color: "#A8ACA0" }}>お休み中は2日ルールの通知が出ず、継続記録も途切れません。</p>
        </div>
      )}
    </div>
  );
}

function FrequencyPicker({ value, onChange }) {
  const isDaily = !value || value.type === "daily";
  const days = value && value.type === "weekly" ? value.days || [] : [];
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const toggleDay = (i) => {
    const next = days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort();
    onChange({ type: "weekly", days: next });
  };
  return (
    <div>
      <span className="text-[11px]" style={{ color: "#8A9284" }}>いつやる？</span>
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={() => onChange({ type: "daily" })}
          className="flex-1 rounded-xl py-2 text-xs font-display"
          style={{ background: isDaily ? "#2B3328" : "#EFEDE3", color: isDaily ? "#fff" : "#8A9284" }}
        >
          毎日
        </button>
        <button
          type="button"
          onClick={() => onChange({ type: "weekly", days })}
          className="flex-1 rounded-xl py-2 text-xs font-display"
          style={{ background: !isDaily ? "#2B3328" : "#EFEDE3", color: !isDaily ? "#fff" : "#8A9284" }}
        >
          曜日を指定
        </button>
      </div>
      {!isDaily && (
        <div className="flex gap-1 mt-2">
          {weekdays.map((w, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              className="w-8 h-8 rounded-full text-xs font-display"
              style={{ background: days.includes(i) ? "#6E9A5E" : "#EFEDE3", color: days.includes(i) ? "#fff" : "#8A9284" }}
            >
              {w}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddHabitModal({ onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [minimalAction, setMinimalAction] = useState("");
  const [stackTrigger, setStackTrigger] = useState("");
  const [time, setTime] = useState("");
  const [frequency, setFrequency] = useState({ type: "daily" });
  return (
    <div className="fixed inset-0 flex items-end justify-center z-50" style={{ background: "rgba(43,51,40,0.4)" }}>
      <div className="w-full max-w-md rounded-t-3xl p-5 font-body" style={{ background: "#F5F6F1" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base">新しい習慣</h3>
          <button onClick={onClose}><X size={18} color="#8A9284" /></button>
        </div>
        <div className="space-y-3">
          <Field label="習慣の名前" value={title} onChange={setTitle} placeholder="例: 読書" />
          <FrequencyPicker value={frequency} onChange={setFrequency} />
          <Field label="最小実行版（レイジーデイ用）" value={minimalAction} onChange={setMinimalAction} placeholder="例: 1ページだけ読む" />
          <Field label="ハビット・スタッキング（任意）" value={stackTrigger} onChange={setStackTrigger} placeholder="例: 朝コーヒーを淹れた直後に" />
          <Field label="目安時刻（任意）" value={time} onChange={setTime} placeholder="例: 22:00" />
        </div>
        <button
          onClick={() => title.trim() && onSave({ title, minimalAction, stackTrigger, time, frequency })}
          className="w-full mt-5 rounded-xl py-3 font-display text-sm"
          style={{ background: "#6E9A5E", color: "#fff" }}
        >
          保存する
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-[11px]" style={{ color: "#8A9284" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none"
        style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}
      />
    </label>
  );
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  return addDays(dateStr, -d.getDay());
}

function ScheduleView({ items, habits, updateItem }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [mode, setMode] = useState("month");
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);
  const calendarItems = items.filter((i) => i.status === "calendar");

  const dayItems = calendarItems.filter((i) => i.dueDate === selectedDate);
  const combined = useMemo(() => {
    const c = dayItems.map((x) => ({ ...x, kind: "task" }));
    const h = habits.filter((x) => x.time && isScheduledOn(x, selectedDate)).map((x) => ({ ...x, kind: "habit" }));
    return [...c, ...h];
  }, [dayItems, habits]);
  const unassigned = dayItems.filter((t) => !t.time);

  return (
    <div className="px-5">
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode("month")}
          className="flex-1 rounded-xl py-2 text-xs font-display"
          style={{ background: mode === "month" ? "#2B3328" : "#EFEDE3", color: mode === "month" ? "#fff" : "#8A9284" }}
        >
          月で見る
        </button>
        <button
          onClick={() => setMode("week")}
          className="flex-1 rounded-xl py-2 text-xs font-display"
          style={{ background: mode === "week" ? "#2B3328" : "#EFEDE3", color: mode === "week" ? "#fff" : "#8A9284" }}
        >
          週で見る
        </button>
        <button
          onClick={() => setMode("day")}
          className="flex-1 rounded-xl py-2 text-xs font-display"
          style={{ background: mode === "day" ? "#2B3328" : "#EFEDE3", color: mode === "day" ? "#fff" : "#8A9284" }}
        >
          日で見る
        </button>
      </div>

      {mode === "month" && (
        <MonthCalendar
          calendarItems={calendarItems}
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setMode("day"); }}
        />
      )}

      {mode === "week" && (
        <WeekCalendar
          calendarItems={calendarItems}
          habits={habits}
          selectedDate={selectedDate}
          onNavigate={(delta) => setSelectedDate((d) => addDays(d, delta))}
          onPickDay={(d) => { setSelectedDate(d); setMode("day"); }}
        />
      )}

      {mode === "day" && (
        <>
          <DayNav selectedDate={selectedDate} onChange={setSelectedDate} />
          <p className="text-[11px] my-3" style={{ color: "#A8ACA0" }}>
            1日の作業時間を可視化して、詰め込みすぎを防ぎます。（本来はGoogleカレンダーとの連携を想定）
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E4E2D8", background: "#FFFFFF" }}>
            {hours.map((hr) => {
              const slot = `${String(hr).padStart(2, "0")}:00`;
              const here = combined.filter((it) => it.time && it.time.startsWith(String(hr).padStart(2, "0")));
              return (
                <div key={hr} className="flex border-b last:border-b-0" style={{ borderColor: "#F0EEE5", minHeight: 44 }}>
                  <div className="w-14 shrink-0 text-[11px] py-2 pl-3" style={{ color: "#B4B8AA" }}>{slot}</div>
                  <div className="flex-1 py-1.5 pr-2 space-y-1">
                    {here.map((it) => (
                      <div key={it.id} className="text-xs rounded-lg px-2 py-1" style={{ background: it.kind === "habit" ? "#F5EEDB" : "#E9F1E4", color: it.kind === "habit" ? "#B5872F" : "#4E7A44" }}>
                        {it.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {unassigned.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] mb-2" style={{ color: "#8A9284" }}>時間未設定の予定（タップで時間を割り当て）</p>
              <div className="space-y-2">
                {unassigned.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
                    <span className="text-sm">{t.title}</span>
                    <select
                      onChange={(e) => updateItem(t.id, { time: e.target.value })}
                      defaultValue=""
                      className="text-xs rounded-lg px-2 py-1 outline-none"
                      style={{ border: "1px solid #E4E2D8", color: "#8A9284" }}
                    >
                      <option value="" disabled>時間を選ぶ</option>
                      {hours.map((h) => (
                        <option key={h} value={`${String(h).padStart(2, "0")}:00`}>{h}:00</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WeekCalendar({ calendarItems, habits, selectedDate, onNavigate, onPickDay }) {
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);
  const weekStart = getWeekStart(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekdayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const HOUR_COL = 40;
  const DAY_COL = 64;

  const itemsFor = (day, hour) => {
    const hh = String(hour).padStart(2, "0");
    const cal = calendarItems.filter((it) => it.dueDate === day && it.time && it.time.startsWith(hh));
    const hab = habits.filter((h) => h.time && h.time.startsWith(hh) && isScheduledOn(h, day));
    return [...cal.map((x) => ({ ...x, kind: "task" })), ...hab.map((x) => ({ ...x, kind: "habit" }))];
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onNavigate(-7)} className="text-sm px-2" style={{ color: "#8A9284" }}>‹</button>
        <p className="font-display text-sm">{fmtJP(days[0])} 〜 {fmtJP(days[6])}</p>
        <button onClick={() => onNavigate(7)} className="text-sm px-2" style={{ color: "#8A9284" }}>›</button>
      </div>

      <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid #E4E2D8", background: "#FFFFFF" }}>
        <div style={{ display: "grid", gridTemplateColumns: `${HOUR_COL}px repeat(7, ${DAY_COL}px)`, minWidth: HOUR_COL + DAY_COL * 7 }}>
          <div style={{ borderBottom: "1px solid #E4E2D8" }} />
          {days.map((d) => {
            const isToday = d === todayStr();
            const isSelected = d === selectedDate;
            return (
              <button
                key={d}
                onClick={() => onPickDay(d)}
                className="flex flex-col items-center py-1.5"
                style={{ borderBottom: "1px solid #E4E2D8", borderLeft: "1px solid #F0EEE5", background: isSelected ? "#E9F1E4" : isToday ? "#FBF7EE" : "transparent" }}
              >
                <span className="text-[9px]" style={{ color: "#B4B8AA" }}>{weekdayNames[new Date(d).getDay()]}</span>
                <span className="text-xs font-display" style={{ color: isToday ? "#6E9A5E" : "#2B3328" }}>{Number(d.slice(-2))}</span>
              </button>
            );
          })}

          {hours.map((hr) => (
            <React.Fragment key={hr}>
              <div className="text-[9px] text-right pr-1 pt-1" style={{ color: "#B4B8AA", borderBottom: "1px solid #F0EEE5", minHeight: 40 }}>
                {hr}:00
              </div>
              {days.map((d) => {
                const here = itemsFor(d, hr);
                return (
                  <div
                    key={d + hr}
                    className="p-0.5 space-y-0.5"
                    style={{ borderBottom: "1px solid #F0EEE5", borderLeft: "1px solid #F0EEE5", minHeight: 40 }}
                  >
                    {here.map((it) => (
                      <div
                        key={it.id}
                        title={it.title}
                        className="text-[8px] rounded px-1 truncate"
                        style={{ background: it.kind === "habit" ? "#F5EEDB" : "#E9F1E4", color: it.kind === "habit" ? "#B5872F" : "#4E7A44" }}
                      >
                        {it.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <p className="text-[11px] mt-3" style={{ color: "#A8ACA0" }}>日付をタップすると、その日の詳しいタイムブロッキングを見られます。</p>
    </div>
  );
}

function DayNav({ selectedDate, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "#FFFFFF", border: "1px solid #E4E2D8" }}>
      <button onClick={() => onChange(addDays(selectedDate, -1))} className="text-sm px-2" style={{ color: "#8A9284" }}>‹</button>
      <div className="flex items-center gap-2">
        <span className="font-display text-sm">{fmtJP(selectedDate)}</span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs outline-none"
          style={{ color: "#8A9284" }}
        />
      </div>
      <button onClick={() => onChange(addDays(selectedDate, 1))} className="text-sm px-2" style={{ color: "#8A9284" }}>›</button>
    </div>
  );
}

function MonthCalendar({ calendarItems, selectedDate, onSelectDate }) {
  const [cursor, setCursor] = useState(`${selectedDate.slice(0, 7)}-01`);
  const year = Number(cursor.slice(0, 4));
  const month = Number(cursor.slice(5, 7));

  const firstOfMonth = new Date(year, month - 1, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const countByDate = useMemo(() => {
    const map = {};
    calendarItems.forEach((it) => {
      if (!it.dueDate) return;
      map[it.dueDate] = (map[it.dueDate] || 0) + 1;
    });
    return map;
  }, [calendarItems]);

  const shiftMonth = (n) => {
    const d = new Date(year, month - 1 + n, 1);
    setCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => shiftMonth(-1)} className="text-sm px-2" style={{ color: "#8A9284" }}>‹</button>
        <p className="font-display text-sm">{year}年{month}月</p>
        <button onClick={() => shiftMonth(1)} className="text-sm px-2" style={{ color: "#8A9284" }}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
          <div key={w} className="text-center text-[10px]" style={{ color: "#B4B8AA" }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isToday = d === todayStr();
          const isSelected = d === selectedDate;
          const count = countByDate[d] || 0;
          return (
            <button
              key={d}
              onClick={() => onSelectDate(d)}
              className="aspect-square rounded-lg flex flex-col items-center justify-center relative"
              style={{
                background: isSelected ? "#2B3328" : isToday ? "#E9F1E4" : "#FFFFFF",
                border: "1px solid #E4E2D8",
                color: isSelected ? "#fff" : "#2B3328",
              }}
            >
              <span className="text-xs">{Number(d.slice(-2))}</span>
              {count > 0 && (
                <span
                  className="w-1.5 h-1.5 rounded-full mt-0.5"
                  style={{ background: isSelected ? "#9EB596" : "#6E9A5E" }}
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] mt-3" style={{ color: "#A8ACA0" }}>緑の点がある日には予定が入っています。日付をタップすると詳細を見られます。</p>
    </div>
  );
}
