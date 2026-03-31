import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 確実にデータが取れることがわかっているUniverse IDのリスト（有名どころ）
  // 今後、ここを自動で増やしていく仕組みを作ればOKです
  const targetUniverseIds = [
    "1530913181", // Work at a Pizza Place
    "652415125",  // Jailbreak
    "920587237",  // Adopt Me!
    "2041310701", // Tower of Hell
    "192800"      // Natural Disaster Survival
    // ...あとでここを30個くらいに増やしましょう
  ];

  try {
    // 複数のUniverse IDを一気に取得する「multiget」APIを使用
    // これは検索APIより圧倒的に安定しています
    const idsQuery = targetUniverseIds.join(',');
    const url = `https://games.roblox.com/v1/games?universeIds=${idsQuery}`;
    
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    const result = await res.json();

    if (!result.data || result.data.length === 0) {
      return NextResponse.json({ message: "Multiget API also failed", raw: result });
    }

    let savedCount = 0;
    for (const game of result.data) {
      const uId = game.universeId.toString();

      // gamesテーブルの更新
      await supabase.from('games').upsert({
        universe_id: uId,
        name: game.name,
        root_place_id: game.rootPlaceId,
        last_scanned_at: new Date().toISOString()
      });

      // 数値（スナップショット）の保存
      await supabase.from('game_snapshots').insert({
        universe_id: uId,
        player_count: game.playing || 0,
        visit_count: game.visits || 0,
        favorited_count: 0
      });

      savedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: "Data collection successful via Multiget API",
      saved: savedCount 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
