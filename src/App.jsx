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
  if (recent.length 
