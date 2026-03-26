// これが「サーバー側」で実行されるNext.jsの最新の書き方です
export default async function Home() {
  // Roblox APIをサーバーから叩く（CORS制限を回避！）
  // 今回は「Universe ID: 155615604 (例)」の情報を取得します
  const res = await fetch('https://games.roblox.com/v1/games?universeIds=155615604', { 
    cache: 'no-store' // 常に最新データを取る設定
  });
  const data = await res.json();
  const game = data.data[0];

  return (
    <main style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#0070f3' }}>🚀 Roblox 発掘 Next.js版</h1>
      <p>このデータはサーバー経由で取得されました（CORS制限突破）</p>
      
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '10px', 
        padding: '20px', 
        maxWidth: '400px', 
        margin: '20px auto',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <h2>{game.name}</h2>
        <p style={{ fontSize: '1.2rem' }}>
          現在のプレイヤー数: <strong>{game.playing.toLocaleString()}人</strong>
        </p>
        <p style={{ color: '#666' }}>お気に入り数: {game.favoritedCount}</p>
        
        <a href={`https://www.roblox.com/games/${game.rootPlaceId}`} target="_blank" rel="noopener noreferrer">
          <button style={{ 
            backgroundColor: '#0070f3', 
            color: 'white', 
            border: 'none', 
            padding: '10px 20px', 
            borderRadius: '5px', 
            cursor: 'pointer',
            fontSize: '1rem'
          }}>
            Robloxで遊ぶ
          </button>
        </a>
      </div>
      
      <p style={{ marginTop: '40px', fontSize: '0.8rem', color: '#999' }}>
        ※これが動けば、あとは同接0人のゲームを探すプログラムを追加するだけです！
      </p>
    </main>
  );
}
