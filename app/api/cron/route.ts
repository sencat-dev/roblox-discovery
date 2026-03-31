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

    // ここを gameData に統一しました
    const gameData = data.data[0];

    // Supabaseへの保存とエラー詳細の取得
    const { error: dbError } = await supabase.from('games').upsert({
      universe_id: universeId,
      name: gameData.name,
      root_place_id: gameData.rootPlaceId,
      last_scanned_at: new Date().toISOString()
    });

    if (dbError) {
      // 保存に失敗した場合、Supabaseが返してきたエラーをそのまま画面に出す
      return NextResponse.json({ 
        status: "Supabase Error", 
        message: dbError.message, 
        details: dbError.details,
        hint: dbError.hint
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Successfully saved!", 
      game: gameData.name 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
