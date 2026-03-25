export const SAMPLE_DATASET_CSV_FILENAME = 'valhalla-eval-dataset-sample.csv'

export const SAMPLE_DATASET_CSV_CONTENT = [
  'content',
  '"请阅读短文后回答：小明周末先去图书馆借书，再去公园跑步。小明先去了哪里？"',
  '"请根据材料概括中心思想：春天到了，校园里的柳树发芽了，花坛里的花也开了。"',
  '"阅读对话并判断：老师说周三交作业，小红周二晚上完成了。小红是否按时完成？"',
].join('\n')

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      row.push(current.trim())
      current = ''
      continue
    }

    if (char === '\n') {
      row.push(current.trim())
      rows.push(row)
      row = []
      current = ''
      continue
    }

    if (char !== '\r') {
      current += char
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim())
    rows.push(row)
  }

  return rows
}

export function parseCsvFirstColumn(text: string): string[] {
  return parseCsvRows(text)
    .map(columns => columns[0]?.trim())
    .filter((value): value is string => Boolean(value))
    .filter(value => !['content', 'question', '测试数据', '题目'].includes(value.toLowerCase()))
}
