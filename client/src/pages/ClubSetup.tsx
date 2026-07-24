import { useState } from "react";
import { Trophy, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ClubSetup() {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [season, setSeason] = useState("2026");
  const [league, setLeague] = useState("");
  const [done, setDone] = useState(false);

  const createClub = trpc.clubs.create.useMutation();
  const joinClub = trpc.clubs.join.useMutation();

  const isPending = createClub.isPending || joinClub.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const club = await createClub.mutateAsync({ name, city, season, league });
    if (club) {
      await joinClub.mutateAsync({ clubId: club.id });
      await utils.auth.me.invalidate();
      setDone(true);
      setTimeout(() => window.location.assign("/"), 1000);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary">
            <Trophy className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">初始化你的俱乐部</h1>
            <p className="text-sm text-slate-300">完成设置后即可开始管理赞助商权益验收</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>俱乐部信息</CardTitle>
            <CardDescription>填写基本信息以创建俱乐部空间</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
                <p className="font-medium">设置完成，正在进入系统...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="club-name">俱乐部名称 *</Label>
                  <Input id="club-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="club-city">城市</Label>
                  <Input id="club-city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="club-season">赛季</Label>
                  <Input id="club-season" value={season} onChange={(e) => setSeason(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="club-league">联赛名称</Label>
                  <Input id="club-league" value={league} onChange={(e) => setLeague(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "创建中..." : "完成设置"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
