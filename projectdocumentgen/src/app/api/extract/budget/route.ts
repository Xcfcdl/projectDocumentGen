import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `你是一个专业的工程预算专家。你的任务是将工程数据映射到预算表结构中。请执行以下任务：

1. 数据映射规则：
   - 严格按照预算表结构映射数据
   - 保持数据的完整性和准确性
   - 确保所有字段都有合适的值
   - 处理缺失字段的默认值
   - 验证数据的合理性
   - 确保数据的可追溯性

2. 工程量处理：
   - 确保单位一致性
   - 验证工程量计算
   - 处理跨专业工程量
   - 确保工程量准确性
   - 验证工程量合理性
   - 检查工程量完整性

3. 价格处理：
   - 确保单价与总价关系正确
   - 处理单位换算
   - 验证价格合理性
   - 确保价格准确性
   - 检查价格完整性
   - 验证价格一致性

4. 专业分类：
   - 确保专业分类准确
   - 处理跨专业项目
   - 验证分类合理性
   - 确保分类完整性
   - 检查分类一致性
   - 维护分类层级

5. 数据质量控制：
   - 检查数据完整性
   - 验证数据准确性
   - 确保数据可追溯性
   - 检查数据一致性
   - 验证数据合理性
   - 评估数据质量

6. 数据关联性：
   - 建立项目间关系
   - 确保工程量与价格对应
   - 维护专业分类关系
   - 建立跨专业关联
   - 确保数据引用一致性
   - 维护数据依赖关系

7. 错误处理与修复：
   - 识别数据异常
   - 提供修复建议
   - 标注需要人工确认的数据
   - 处理数据冲突
   - 提供数据验证建议
   - 记录处理过程

8. 数据质量评估：
   - 计算数据完整性得分
   - 计算数据准确性得分
   - 计算数据一致性得分
   - 计算数据关联性得分
   - 生成质量报告
   - 提供改进建议

9. 输出格式优化：
   - 确保JSON结构清晰
   - 优化数据层级
   - 统一数据格式
   - 确保数据可读性
   - 优化数据压缩
   - 确保数据可解析性

10. 特殊处理：
    - 处理特殊工程量
    - 处理特殊价格
    - 处理跨专业项目
    - 处理特殊分类
    - 处理特殊要求
    - 处理特殊情况

请确保：
1. 所有数值都包含单位
2. 保持数据的层级结构清晰
3. 表格数据转换为数组格式
4. 缺失信息使用null或空数组
5. 不捏造数据，保持真实性
6. 坐标点使用二维数组格式
7. 所有文本使用中文
8. 数值类型的数据不要加引号
9. 包含数据质量评分
10. 包含数据验证状态
11. 包含数据关联信息
12. 包含错误处理信息

直接返回JSON数据，不要包含任何markdown标记或其他说明文字。`;

export async function POST(req: NextRequest) {
  try {
    const { task_id, files, summary } = await req.json();
    const apiKey = process.env.DEEPSEEK_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: '未配置AI接口密钥' }, { status: 500 });
    }
    // 读取概算表结构模板
    const templatePath = path.join(process.cwd(), 'public/datatem/概算.json');
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

    // 组装 prompt
    const userPrompt = `请将以下"归纳整理内容"映射为"概算表结构"对应的JSON格式。\n\n归纳整理内容：\n${JSON.stringify(summary, null, 2)}\n\n概算表结构示例：\n${JSON.stringify(template, null, 2)}\n\n请只输出JSON。值的语言为中文。所有输出必须严格基于输入内容，不允许有任何AI幻觉、捏造、凭空推测或虚构信息，缺失内容请用null或空数组。`;

    // 调用 deepseek
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000
    });
    let content = response.data.choices?.[0]?.message?.content?.trim() || '';
    content = content.replace(/```json|```/g, '').trim();
    let budget;
    try {
      budget = JSON.parse(content);
    } catch (e) {
      return NextResponse.json({ error: 'AI返回内容无法解析为JSON', raw: content }, { status: 500 });
    }
    // 可选：保存 budget.json
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
    await fs.ensureDir(uploadDir);
    await fs.writeJson(path.join(uploadDir, 'budget.json'), budget, { spaces: 2 });
    // 更新活跃时间戳
    await fs.writeFile(path.join(uploadDir, '.active'), Date.now().toString());
    return NextResponse.json({ summary: budget });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '生成概算表失败' }, { status: 500 });
  }
} 