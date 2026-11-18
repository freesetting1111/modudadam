"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type Props = { label: string; name: string; defaultValue: string };
const weekdays = ["일","월","화","수","목","금","토"];

export function AdminDatePicker({ label, name, defaultValue }: Props) {
  const [value,setValue] = useState(defaultValue);
  const initial = parseDate(defaultValue);
  const [view,setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [open,setOpen] = useState(false);
  const cells = calendarCells(view.year,view.month);
  return <div className="admin-date-picker">
    <span>{label}</span>
    <input type="hidden" name={name} value={value}/>
    <button type="button" className="admin-date-trigger" aria-expanded={open} onClick={() => setOpen((current) => !current)}><strong>{value}</strong><CalendarDays size={21}/></button>
    {open && <div className="admin-calendar" role="dialog" aria-label={`${label} 선택`}>
      <header><button type="button" aria-label="이전 달" onClick={() => setView(previousMonth(view))}><ChevronLeft/></button><strong>{view.year}년 {view.month + 1}월</strong><button type="button" aria-label="다음 달" onClick={() => setView(nextMonth(view))}><ChevronRight/></button></header>
      <div className="admin-calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="admin-calendar-days">{cells.map((cell,index) => cell ? <button type="button" className={formatDate(cell) === value ? "selected" : ""} key={formatDate(cell)} onClick={() => { setValue(formatDate(cell)); setOpen(false); }}>{cell.getDate()}</button> : <span key={`empty-${index}`}/>)}</div>
      <footer><button type="button" onClick={() => { const today = new Date(); setView({ year:today.getFullYear(),month:today.getMonth() }); setValue(formatDate(today)); setOpen(false); }}>오늘</button><button type="button" onClick={() => setOpen(false)}>닫기</button></footer>
    </div>}
  </div>;
}

function parseDate(value: string) { const [year,month,day] = value.split("-").map(Number); return new Date(year,month - 1,day); }
function formatDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function calendarCells(year: number,month: number) { const firstDay = new Date(year,month,1).getDay(); const lastDate = new Date(year,month + 1,0).getDate(); return Array.from({ length: firstDay + lastDate },(_,index) => index < firstDay ? null : new Date(year,month,index - firstDay + 1)); }
function previousMonth(view: { year:number; month:number }) { const date = new Date(view.year,view.month - 1,1); return { year:date.getFullYear(),month:date.getMonth() }; }
function nextMonth(view: { year:number; month:number }) { const date = new Date(view.year,view.month + 1,1); return { year:date.getFullYear(),month:date.getMonth() }; }
