import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const keywords = ["new", "beta", "obby", "tycoon", "simulator", "update"];
  const currentHour = new Date().getHours();
  const selectedKeyword = keywords[currentHour % keywords.length];

  try {
    // 新着寄りの検索APIに変更
    const searchUrl = `https://discover.roblox.com/v1/search/games?keyword=${encodeURIComponent(selectedKeyword)}&limit=30`;

    const res = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Roblox API error: ${res.status}` },
        { status: 500 }
      );
    }

    const searchData = await res.json();

    if (!searchData.data || searchData.data.length === 0) {
      return NextResponse.json({
        message: "No data returned",
        keyword: selectedKeyword,
        raw: searchData
      });
    }

    let savedCount = 0;

    for (const game of searchData.data) {
      const uId = game.universeId;
      const gameName = game.name || "";
      const visitCount = game.placeVisits || 0;
      const playerCount = game.playerCount || 0;

      // 必須チェック
      if (!uId || !gameName) continue;

      // デフォルト名除外
      if (gameName.toLowerCase().includes("'s place") && visitCount < 10) continue;

      // 新着っぽいフィルタ
      if (visitCount > 5000 || playerCount > 100) continue;

      await supabase.from('games').upsert({
        universe_id: uId.toString(),
        name: gameName,
        root_place_id: game.rootPlaceId,
        last_scanned_at: new Date().toISOString()
      });

      await supabase.from('game_snapshots').insert({
        universe_id: uId.toString(),
        player_count: playerCount,
        visit_count: visitCount,
        favorited_count: game.favoritedCount || 0
      });

      savedCount++;
    }

    return NextResponse.json({
      success: true,
      keyword: selectedKeyword,
      saved: savedCount
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
