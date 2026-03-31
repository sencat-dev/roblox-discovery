import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの初期化（もし lib/supabase からインポートできない場合を想定してここに記述します）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1時間ごとに検索ワードを切り替える設定
  const keywords = ["Horror", "Obby", "Tycoon", "Anime", "Simulator", "Social", "Mystery", "Easy", "Parkour", "Survival"];
  const currentHour = new Date().getUTCHours();
  const selectedKeyword = keywords[currentHour % keywords.length];

  try {
    // --- 1. 新規ゲームの開拓 (Discovery) ---
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(selectedKeyword)}&model.maxRows=30`;
    const searchRes = await fetch(searchUrl, { cache: 'no-store' });
    const searchData = await searchRes.json();

    const debugLogs: string[] = [];

    if (searchData && searchData.data) {
      for (const game of searchData.data) {
        // IDの取得（大文字小文字の両方に対応）
        const rawId = game.universeId || game.UniverseId || game.id;
        if (!rawId) continue;
        const uId = rawId.toString();

        // gamesテーブルに保存
        const { error: err1 } = await supabase.from('games').upsert({
          universe_id: uId,
          name: game.name || game.Name || "Unknown",
          root_place_id: game.rootPlaceId || game.RootPlaceId,
          last_scanned_at: new Date().toISOString()
        });

        if (err1) debugLogs.push(`Upsert Error (${uId}): ${err1.message}`);
      }
    }

    // --- 2. 既存ゲームの定点観測 (Tracking) ---
    // スキャンが古い順に20件取得
    const { data: oldGames } = await supabase
      .from('games')
      .select('universe_id')
      .order('last_scanned_at', { ascending: true })
      .limit(20);

    let trackCount = 0;
    if (oldGames && oldGames.length > 0) {
      const ids = oldGames.map(g => g.universe_id).join(',');
      const detailRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${ids}`, { cache: 'no-store' });
      const detailData = await detailRes.json();

      if (detailData && detailData.data) {
        for (const game of detailData.data) {
          const uId = game.universeId.toString();
          
          // スナップショットを記録
          await supabase.from('game_snapshots').insert({
            universe_id: uId,
            player_count: game.playing || 0,
            visit_count: game.visits || 0,
            favorited_count: 0
          });

          // 最終スキャン時刻を更新
          await supabase.from('games').update({ 
            last_scanned_at: new Date().toISOString() 
          }).eq('universe_id', uId);

          trackCount++;
        }
      }
    }

    // 結果のレスポンス
    return NextResponse.json({ 
      success: true, 
      keyword: selectedKeyword,
      new_discovery_attempted: searchData?.data?.length || 0,
      tracking_updated: trackCount,
      errors: debugLogs.length > 0 ? debugLogs : undefined
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
