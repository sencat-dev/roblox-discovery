import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const targetUniverseIds = [
    "1530913181", // Work at a Pizza Place
    "652415125",  // Jailbreak
    "920587237",  // Adopt Me!
    "2041310701", // Tower of Hell
    "192800"      // Natural Disaster Survival
  ];

  try {
    const idsQuery = targetUniverseIds.join(',');
    const url = `https://games.roblox.com/v1/games?universeIds=${idsQuery}`;
    
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    const result = await res.json();

    // デバッグ用：データが取れなかった場合
    if (!result.data || result.data.length === 0) {
      return NextResponse.json({ 
        message: "No data returned from Roblox", 
        raw: result 
      });
    }

    let savedCount = 0;
    for (const game of result.data) {
      // universeIdが存在するかチェック（ここがエラーの原因でした）
      if (!game || !game.universeId) {
        console.log("Skipping invalid game data");
        continue;
      }

      const uId = game.universeId.toString();

      // 1. gamesテーブル
      await supabase.from('games').upsert({
        universe_id: uId,
        name: game.name || "Unknown Game",
        root_place_id: game.rootPlaceId,
        last_scanned_at: new Date().toISOString()
      });

      // 2. game_snapshotsテーブル
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
      message: "Success!",
      saved: savedCount 
    });

  } catch (error: any) {
    // エラーが起きた場所を特定しやすくする
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
