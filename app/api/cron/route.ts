import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const keywords = ["Horror", "Obby", "Tycoon", "Anime", "Simulator"];
  const currentHour = new Date().getUTCHours();
  const selectedKeyword = keywords[currentHour % keywords.length];

  const report: any = {
    step: "Start",
    keyword: selectedKeyword,
    search_result: null,
    upsert_results: [],
    tracking_results: []
  };

  try {
    // 1. Roblox APIを叩く
    report.step = "Roblox API Fetching";
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(selectedKeyword)}&model.maxRows=30`;
    const res = await fetch(searchUrl, { cache: 'no-store' });
    const result = await res.json();
    report.search_result = { count: result?.data?.length || 0 };

    if (!result.data || result.data.length === 0) {
      return NextResponse.json({ ...report, message: "Robloxからデータが取れませんでした" });
    }

    // 2. 取得したデータをループして保存を試みる
    report.step = "Upserting to Supabase";
    for (const game of result.data) {
      const uId = (game.universeId || game.UniverseId || game.id)?.toString();
      if (!uId) continue;

      const { error } = await supabase.from('games').upsert({
        universe_id: uId,
        name: game.name || "Unknown",
        root_place_id: game.rootPlaceId || game.RootPlaceId,
        last_scanned_at: new Date().toISOString()
      });

      // 保存の成否を記録
      report.upsert_results.push({
        id: uId,
        status: error ? "Failed" : "Success",
        error_msg: error?.message || null
      });
    }

    return NextResponse.json({ ...report, message: "完了しました。結果を確認してください。" });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      step: report.step, 
      error: error.message 
    }, { status: 500 });
  }
}
