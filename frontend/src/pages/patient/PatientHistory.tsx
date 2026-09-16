import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRecentActivity, ActivityItem } from "@/services/api";

export default function PatientHistory() {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  useEffect(() => { getRecentActivity().then(setActivity).catch(() => setActivity([])); }, []);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Access History</h1><p className="text-sm text-muted-foreground">Review activity involving your medical records.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-secondary" />Record Activity</CardTitle></CardHeader><CardContent>{activity.length ? <Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Detail</TableHead><TableHead>Time</TableHead></TableRow></TableHeader><TableBody>{activity.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.action}</TableCell><TableCell>{item.detail}</TableCell><TableCell className="text-muted-foreground">{item.timestamp}</TableCell></TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground">No access events recorded yet.</p>}</CardContent></Card></div>;
}