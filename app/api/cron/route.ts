import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1530913181 は "Work at a Pizza Place" です
  const universeId = "1530913181"; 

  try {
    // 【確認1】Roblox APIからデータが取れるか？
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    
    if (!res.ok) {
      return NextResponse.json({ error: `Roblox API failed: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    
    if (!data.data || data.data.length === 0) {
      return NextResponse.json({ error: "Game not found on Roblox" }, { status: 404 });
    }

    const game = data.data[0];

    // 【確認2】Supabaseへ保存を試みる
const { data: dbData, error: dbError } = await supabase.from('games').upsert({
  universe_id: universeId,
  name: gameData.name,
  root_place_id: gameData.rootPlaceId,
  last_scanned_at: new Date().toISOString()
}).select(); // .select() をつけると結果を返してくれます

if (dbError) {
  return NextResponse.json({ 
    status: "Supabase Reject", 
    error_detail: dbError.message, 
    error_code: dbError.code 
  });
}

    // すべて成功した場合、取得したゲーム名を表示
    return NextResponse.json({ 
      success: true, 
      message: `Saved to Supabase!`,
      fetchedGameName: game.name,
      fetchedUniverseId: universeId
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
