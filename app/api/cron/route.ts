import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // あなたが設定した24時間サイクルのキーワードリスト
  const keywords = ["Horror", "Obby", "Tycoon", "Anime", "Simulator", "Social", "Mystery", "Easy", "Parkour", "Survival"];
  const currentHour = new Date().getUTCHours();
  const selectedKeyword = keywords[currentHour % keywords.length];

  try {
    // 【改善点】キーワード検索をより安定させるため、sortToken（人気順など）を組み合わせるのが一般的ですが、
    // まずは純粋にキーワードで「最新・新着」に近いものを狙います。
    const searchUrl = `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(selectedKeyword)}&model.maxRows=30`;
    
    // Vercelや途中のサーバーのキャッシュを完全に無効化する
    const res = await fetch(searchUrl, { 
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache' } 
    });
    const result = await res.json();

    if (!result.data || result.data.length === 0) {
      // ここでリトライせず、正直に「0件だった」とレスポンスを返す
      // これにより「この時間のこのワードは取れなかった」という事実が記録に残ります
      return NextResponse.json({ 
        success: false, 
        hour: currentHour, 
        keyword: selectedKeyword, 
        message: "Robloxからデータが返ってきませんでした（APIの一時的な不調の可能性があります）" 
      });
    }

    // --- 1. 新規開拓 (Discovery) ---
    const savedIds = [];
    for (const game of result.data) {
      const uId = (game.universeId || game.UniverseId || game.id)?.toString();
      if (!uId) continue;

      const { error } = await supabase.from('games').upsert({
        universe_id: uId,
        name: game.name || "Unknown",
        root_place_id: game.rootPlaceId || game.RootPlaceId,
        last_scanned_at: new Date().toISOString()
      });
      if (!error) savedIds.push(uId);
    }

    // --- 2. 既存の定点観測 (Tracking) ---
    // ここはキーワードに関係なく、DBにある「一番古いデータ」を20件更新する
    const { data: oldGames } = await supabase
      .from('games')
      .select('universe_id')
      .order('last_scanned_at', { ascending: true })
      .limit(20);

    let trackingCount = 0;
    if (oldGames && oldGames.length > 0) {
      const ids = oldGames.map(g => g.universe_id).join(',');
      const detailRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${ids}`, { cache: 'no-store' });
      const detailData = await detailRes.json();
      
      if (detailData?.data) {
        for (const g of detailData.data) {
          await supabase.from('game_snapshots').insert({
            universe_id: g.universeId.toString(),
            player_count: g.playing || 0,
            visit_count: g.visits || 0,
            favorited_count: 0
          });
          await supabase.from('games').update({ last_scanned_at: new Date().toISOString() }).eq('universe_id', g.universeId.toString());
          trackingCount++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      hour: currentHour, 
      keyword: selectedKeyword,
      new_discovered: savedIds.length,
      tracking_updated: trackingCount
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
