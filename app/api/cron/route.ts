import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // テスト用：Robloxに実在するUniverse ID (例: 1530913181 - Work at a Pizza Place)
  const universeId = "1530913181"; 

  try {
    // Roblox APIから実際のデータを取得
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    const data = await res.json();
    const gameData = data.data[0];

    // gamesテーブルに保存
    await supabase.from('games').upsert({
      universe_id: universeId,
      name: gameData.name,
      root_place_id: gameData.rootPlaceId,
      last_scanned_at: new Date().toISOString()
    });

    // snapshot（今の数値）を保存
    await supabase.from('game_snapshots').insert({
      universe_id: universeId,
      player_count: gameData.playing || 0,
      visit_count: gameData.visits || 0,
      favorited_count: 0 // APIの別エンドポイントが必要なため一旦0
    });

    return NextResponse.json({ message: "Real data saved!", game: gameData.name });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
