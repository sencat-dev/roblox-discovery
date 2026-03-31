import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  // 1. テスト用のUniverse ID（後でループ処理に変更できます）
  const universeId = "123456789"; // ここを実際のIDに変えると動きます

  try {
    // 2. Roblox APIからデータを取得（例）
    // 本来はここで fetch('https://games.roblox.com/v1/games?universeIds=...') を叩きます
    const mockData = {
      name: "Test Game",
      playing: 0,
      visits: 100,
      favoritedCount: 50
    };

    // 3. gamesテーブルに基本情報を保存 (upsert: なければ作成、あれば更新)
    const { error: gameError } = await supabase
      .from('games')
      .upsert({
        universe_id: universeId,
        name: mockData.name,
        root_place_id: 0, // 実際は取得した値を入れる
        last_scanned_at: new Date().toISOString()
      });

    if (gameError) throw gameError;

    // 4. game_snapshotsテーブルにその瞬間の数値を保存
    const { error: statsError } = await supabase
      .from('game_snapshots')
      .insert({
        universe_id: universeId,
        player_count: mockData.playing,
        visit_count: mockData.visits,
        favorited_count: mockData.favoritedCount
      });

    if (statsError) throw statsError;

    return NextResponse.json({ message: "Data saved successfully!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
