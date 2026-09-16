import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDoctorAccessHistory, ActivityItem } from "@/services/api";

export default function DoctorAccessHistory() {
  const [history, setHistory] = useState<ActivityItem[]>([]);
  useEffect(() => { getDoctorAccessHistory().then(setHistory).catch(() => setHistory([])); }, []);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Access History</h1><p className="text-sm text-muted-foreground">A record of consent, access requests, and emergency activity.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-secondary" />Audit Timeline</CardTitle></CardHeader><CardContent>{history.length ? <div className="space-y-3">{history.map((item) => <div key={item.id} className="rounded-md border p-4"><p className="font-medium">{item.action}</p><p className="text-sm text-muted-foreground">{item.detail}</p><p className="mt-1 text-xs text-muted-foreground">{item.timestamp}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No access events recorded yet.</p>}</CardContent></Card></div>;
}
