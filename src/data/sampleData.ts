import { DiaryEntry } from '../types/diabetes';

/**
 * Реалистичные демонстрационные данные за последние дни для демонстрации возможностей
 * дневника самоконтроля: замеры сахара, приемы пищи, РинФаст, Тресиба на ночь, калории и заметки.
 */
export function generateSampleData(): DiaryEntry[] {
  const entries: DiaryEntry[] = [];
  const today = new Date();

  // Создаем данные за последние 14 дней с разным профилем гликемии
  const scenarios = [
    // День 0 (Сегодня)
    [
      { time: '07:45', glucose: 5.6, carbs: 36, xe: 3.0, rinFast: 5, tresiba: null, calories: 340, notes: 'Овсяная каша на воде с ягодами, кофе', tag: 'breakfast' },
      { time: '11:15', glucose: 7.4, carbs: 12, xe: 1.0, rinFast: null, tresiba: null, calories: 120, notes: 'Яблоко зеленое перед прогулкой', tag: 'snack' },
      { time: '13:30', glucose: 6.2, carbs: 60, xe: 5.0, rinFast: 8, tresiba: null, calories: 620, notes: 'Гречка с куриным филе, овощной салат', tag: 'lunch' },
      { time: '16:00', glucose: 8.8, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: 'Через 2.5ч после обеда, замер сахара', tag: 'other' },
      { time: '19:15', glucose: 5.9, carbs: 48, xe: 4.0, rinFast: 6, tresiba: null, calories: 480, notes: 'Рыба на пару, запеченный картофель', tag: 'dinner' },
      { time: '22:30', glucose: 6.5, carbs: null, xe: null, rinFast: null, tresiba: 16, calories: null, notes: 'Перед сном: Тресиба 16 ед в бедро', tag: 'bedtime' },
    ],
    // День 1 (Вчера)
    [
      { time: '08:00', glucose: 5.1, carbs: 42, xe: 3.5, rinFast: 6, tresiba: null, calories: 390, notes: 'Творог 5% с черникой и тост цельнозерновой', tag: 'breakfast' },
      { time: '13:10', glucose: 10.4, carbs: 54, xe: 4.5, rinFast: 8, tresiba: null, calories: 580, notes: 'Высоковат перед обедом (+1 ед ДПС на снижение)', tag: 'lunch' },
      { time: '18:45', glucose: 6.8, carbs: 40, xe: 3.3, rinFast: 5, tresiba: null, calories: 430, notes: 'Омлет с овощами и зеленью', tag: 'dinner' },
      { time: '21:00', glucose: 3.7, carbs: 15, xe: 1.3, rinFast: null, tresiba: null, calories: 80, notes: 'Легкое гипо после тренировки, выпил 150 мл сока', tag: 'snack' },
      { time: '22:45', glucose: 6.2, carbs: null, xe: null, rinFast: null, tresiba: 16, calories: null, notes: 'На ночь: Тресиба 16 ед', tag: 'bedtime' },
    ],
    // День 2 (2 дня назад)
    [
      { time: '07:30', glucose: 6.0, carbs: 36, xe: 3.0, rinFast: 5, tresiba: null, calories: 320, notes: 'Гречневые хлопья с миндальным молоком', tag: 'breakfast' },
      { time: '13:00', glucose: 5.8, carbs: 65, xe: 5.4, rinFast: 9, tresiba: null, calories: 650, notes: 'Суп чечевичный, рис басмати с телятиной', tag: 'lunch' },
      { time: '15:30', glucose: 9.2, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: 'Контроль постпрандиального пика', tag: 'other' },
      { time: '19:30', glucose: 6.4, carbs: 45, xe: 3.8, rinFast: 6, tresiba: null, calories: 460, notes: 'Индейка с тушеной капустой', tag: 'dinner' },
      { time: '23:00', glucose: 7.1, carbs: null, xe: null, rinFast: null, tresiba: 16, calories: null, notes: 'Тресиба 16 ед', tag: 'bedtime' },
    ],
    // День 3 (3 дня назад)
    [
      { time: '08:15', glucose: 4.8, carbs: 30, xe: 2.5, rinFast: 4, tresiba: null, calories: 290, notes: 'Яичница с томатами, цельнозерновой хлеб', tag: 'breakfast' },
      { time: '12:45', glucose: 6.7, carbs: 55, xe: 4.6, rinFast: 7, tresiba: null, calories: 530, notes: 'Булгур с овощами и курицей', tag: 'lunch' },
      { time: '18:00', glucose: 14.5, carbs: 50, xe: 4.2, rinFast: 9, tresiba: null, calories: 510, notes: 'День рождения коллеги (торт!), +2 ед ДПС', tag: 'dinner' },
      { time: '21:30', glucose: 8.5, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: 'Сахар снижается после коррекции', tag: 'other' },
      { time: '22:50', glucose: 6.8, carbs: null, xe: null, rinFast: null, tresiba: 16, calories: null, notes: 'Тресиба 16 ед перед сном', tag: 'bedtime' },
    ],
    // День 4
    [
      { time: '07:50', glucose: 5.3, carbs: 36, xe: 3.0, rinFast: 5, tresiba: null, calories: 330, notes: 'Овсяная каша с грецким орехом', tag: 'breakfast' },
      { time: '13:15', glucose: 6.1, carbs: 50, xe: 4.2, rinFast: 7, tresiba: null, calories: 540, notes: 'Паста твердых сортов с морепродуктами', tag: 'lunch' },
      { time: '19:00', glucose: 5.7, carbs: 42, xe: 3.5, rinFast: 5, tresiba: null, calories: 420, notes: 'Салат цезарь с индейкой', tag: 'dinner' },
      { time: '22:30', glucose: 6.3, carbs: null, xe: null, rinFast: null, tresiba: 16, calories: null, notes: 'Тресиба 16 ед', tag: 'bedtime' },
    ],
    // День 5
    [
      { time: '08:00', glucose: 4.9, carbs: 32, xe: 2.7, rinFast: 4, tresiba: null, calories: 310, notes: 'Сырники без муки, сметана 15%', tag: 'breakfast' },
      { time: '13:00', glucose: 6.5, carbs: 60, xe: 5.0, rinFast: 8, tresiba: null, calories: 600, notes: 'Гречневая каша, котлеты на пару', tag: 'lunch' },
      { time: '19:20', glucose: 7.2, carbs: 45, xe: 3.8, rinFast: 6, tresiba: null, calories: 470, notes: 'Тушеные овощи с говядиной', tag: 'dinner' },
      { time: '23:00', glucose: 5.8, carbs: null, xe: null, rinFast: null, tresiba: 16, calories: null, notes: 'Тресиба 16 ед', tag: 'bedtime' },
    ],
    // День 6
    [
      { time: '07:40', glucose: 5.5, carbs: 36, xe: 3.0, rinFast: 5, tresiba: null, calories: 340, notes: 'Каша геркулес, вареное яйцо', tag: 'breakfast' },
      { time: '13:30', glucose: 6.9, carbs: 55, xe: 4.6, rinFast: 7, tresiba: null, calories: 560, notes: 'Борщ постный, картофель отварной с рыбой', tag: 'lunch' },
      { time: '19:00', glucose: 6.1, carbs: 40, xe: 3.3, rinFast: 5, tresiba: null, calories: 410, notes: 'Творожная запеканка', tag: 'dinner' },
      { time: '22:40', glucose: 6.4, carbs: null, xe: null, rinFast: null, tresiba: 16, calories: null, notes: 'Тресиба 16 ед на ночь', tag: 'bedtime' },
    ],
    // День 7
    [
      { time: '08:20', glucose: 5.2, carbs: 40, xe: 3.3, rinFast: 5, tresiba: null, calories: 370, notes: 'Завтрак выходного дня: сыр, кофе, тосты', tag: 'breakfast' },
      { time: '14:00', glucose: 7.0, carbs: 65, xe: 5.4, rinFast: 9, tresiba: null, calories: 680, notes: 'Плов с курицей, салат ачичук', tag: 'lunch' },
      { time: '19:40', glucose: 6.3, carbs: 44, xe: 3.7, rinFast: 6, tresiba: null, calories: 450, notes: 'Куриная грудка гриль, стручковая фасоль', tag: 'dinner' },
      { time: '23:10', glucose: 5.9, carbs: null, xe: null, rinFast: null, tresiba: 16, calories: null, notes: 'Тресиба 16 ед', tag: 'bedtime' },
    ],
  ];

  let idCounter = 1;

  for (let dayOffset = 0; dayOffset < scenarios.length; dayOffset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - dayOffset);
    const dateStr = d.toISOString().slice(0, 10);

    const dayItems = scenarios[dayOffset];
    for (const item of dayItems) {
      entries.push({
        id: `sample-${idCounter++}`,
        date: dateStr,
        time: item.time,
        glucose: item.glucose,
        carbs: item.carbs,
        xe: item.xe,
        rinFast: item.rinFast,
        tresiba: item.tresiba,
        calories: item.calories,
        notes: item.notes,
        tag: item.tag as any,
        createdAt: Date.now() - dayOffset * 86400000,
      });
    }
  }

  return entries;
}
