import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sortTypes = ["MostEngaged", "TopRated", "Popular"];
  const currentHour = new Date().getHours();
  const selectedSort = sortTypes[currentHour % sortTypes.length];

  try {
    const searchUrl = `https://games.roblox.com/v1/games/sort?sortToken=&maxRows=30&sortOrder=Desc&sortType=${selectedSort}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Roblox API error: ${res.status}`, body: text },
        { status: 500 }
      );
    }

    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      return NextResponse.json({
        message: "No data returned",
        sortType: selectedSort,
        raw: data
      });
    }

    let savedCount = 0;

    for (const game of data.data) {
      const uId = game.universeId;
      const name = game.name || "";
      const visits = game.placeVisits || 0;
      const players = game.playerCount || 0;

      if (!uId || !name) continue;

      // デフォルト名除外
      if (name.toLowerCase().includes("'s place") && visits < 10) continue;

      await supabase.from('games').upsert({
        universe_id: uId.toString(),
        name,
        root_place_id: game.rootPlaceId,
        last_scanned_at: new Date().toISOString()
      });

      await supabase.from('game_snapshots').insert({
        universe_id: uId.toString(),
        player_count: players,
        visit_count: visits,
        favorited_count: game.favoritedCount || 0
      });

      savedCount++;
    }

    return NextResponse.json({
      success: true,
      sortType: selectedSort,
      saved: savedCount
    });

  } catch (error: any) {
    console.error("FETCH ERROR:", error);

    return NextResponse.json(
      { error: error.message || "fetch failed" },
      { status: 500 }
    );
  }
}
