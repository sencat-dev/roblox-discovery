import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 【修正】これらは「Universe ID」として正しい数値です
  const targetUniverseIds = [
    "2324662457", // Brookhaven 🏠
    "1530913181", // Work at a Pizza Place 🍕
    "652415125",  // Jailbreak 🏎️
    "920587237",  // Adopt Me! 🐶
    "2041310701"  // Tower of Hell 🗼
  ];

  try {
    const idsQuery = targetUniverseIds.join(',');
    const url = `https://games.roblox.com/v1/games?universeIds=${idsQuery}`;
    
    const res = await fetch(url);
    const result = await res.json();

    // 取得できたデータがあるかログに出す
    if (!result.data || result.data.length === 0) {
      return NextResponse.json({ message: "No data", raw: result });
    }

    let savedCount = 0;
    for (const game of result.data) {
      // データの存在チェックをより厳密に
      if (!game || game.universeId === undefined) continue;

      const uId = game.universeId.toString();

      // gamesテーブルへの保存
      const { error: err1 } = await supabase.from('games').upsert({
        universe_id: uId,
        name: game.name || "Unknown",
        root_place_id: game.rootPlaceId,
        last_scanned_at: new Date().toISOString()
      });
      if (err1) console.error("Error games:", err1);

      // snapshotsテーブルへの保存
      const { error: err2 } = await supabase.from('game_snapshots').insert({
        universe_id: uId,
        player_count: game.playing || 0,
        visit_count: game.visits || 0,
        favorited_count: 0
      });
      if (err2) console.error("Error snapshots:", err2);

      savedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      saved: savedCount,
      games: result.data.map((g: any) => g.name) // 取得できたゲーム名を表示
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
