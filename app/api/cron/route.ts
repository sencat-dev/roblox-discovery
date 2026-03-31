import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const universeId = "1530913181"; 

  try {
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      return NextResponse.json({ error: "Game not found" });
    }

    const gameData = data.data[0];

    // 1. gamesテーブルに基本情報を保存 (upsert)
    const { error: gameError } = await supabase.from('games').upsert({
      universe_id: universeId,
      name: gameData.name,
      root_place_id: gameData.rootPlaceId,
      last_scanned_at: new Date().toISOString()
    });

    if (gameError) throw new Error(`Games table: ${gameError.message}`);

    // 2. game_snapshotsテーブルに「今の数値」を保存 (insert)
    const { error: snapshotError } = await supabase.from('game_snapshots').insert({
      universe_id: universeId,
      player_count: gameData.playing || 0,
      visit_count: gameData.visits || 0,
      favorited_count: 0 // お気に入り数は別APIが必要なため一旦0
    });

    if (snapshotError) throw new Error(`Snapshots table: ${snapshotError.message}`);

    return NextResponse.json({ 
      success: true, 
      message: "Both tables updated!", 
      game: gameData.name,
      players: gameData.playing
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
