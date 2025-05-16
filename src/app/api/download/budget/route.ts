import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { summary } = await req.json();
    if (!summary || typeof summary !== 'object') {
      return Response.json({ error: '未提供有效的概算表数据' }, { status: 400 });
    }

    // 导出为JSON
    const jsonStr = JSON.stringify(summary, null, 2);
    return new Response(jsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="概算表.json"',
      },
    });
  } catch (e: any) {
    console.error('导出概算表失败:', e);
    return Response.json({ error: e.message || '导出概算表失败' }, { status: 500 });
  }
} 