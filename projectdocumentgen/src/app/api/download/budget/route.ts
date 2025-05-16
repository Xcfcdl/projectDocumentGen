import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { summary } = await req.json();
    if (!summary || typeof summary !== 'object') {
      return Response.json({ error: '未提供有效的概算表数据' }, { status: 400 });
    }

    // 只导出分部分项
    let csv = '专业,名称,数量,单位,单价,合价,人工占比,材料占比\n';
    if (Array.isArray(summary.subprojects)) {
      for (const sp of summary.subprojects) {
        if (Array.isArray(sp.items)) {
          for (const item of sp.items) {
            csv += [
              sp.major ?? '',
              item.name ?? '',
              item.quantity ?? '',
              item.unit ?? '',
              item.unit_price ?? '',
              item.total_price ?? '',
              item.labor_ratio ?? '',
              item.material_ratio ?? ''
            ].join(',') + '\n';
          }
        }
      }
    }

    // 关键：转为 UTF-8 Uint8Array，避免 ByteString 错误
    const encoder = new TextEncoder();
    const csvBuffer = encoder.encode(csv);

    return new Response(new Blob([csvBuffer], { type: 'text/csv; charset=utf-8' }), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="概算表.csv"',
      },
    });
  } catch (e: any) {
    console.error('导出概算表失败:', e);
    return Response.json({ error: e.message || '导出概算表失败' }, { status: 500 });
  }
} 