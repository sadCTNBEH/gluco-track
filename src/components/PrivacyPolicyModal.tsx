import React from 'react';
import { X, ShieldCheck, Lock, FileText, AlertTriangle, Database, CheckCircle2 } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'policy' | 'medical';
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'policy',
}) => {
  const [activeTab, setActiveTab] = React.useState<'policy' | 'medical'>(defaultTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Правовая информация и конфиденциальность
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Соответствие законодательству РФ (152-ФЗ и 323-ФЗ)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('policy')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'policy'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Политика обработки данных (152-ФЗ)</span>
          </button>
          <button
            onClick={() => setActiveTab('medical')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'medical'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Медицинский отказ от ответственности (323-ФЗ)</span>
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {activeTab === 'policy' ? (
            <>
              {/* Блок о трансграничной передаче и хранении данных */}
              <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/50 flex items-start gap-3">
                <Database className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mb-0.5">
                    Размещение сервера и трансграничная передача данных (ст. 12 152-ФЗ РФ / GDPR)
                  </div>
                  <p className="text-[11px] text-teal-800 dark:text-teal-300">
                    Серверное оборудование и база данных расположены на территории Королевства Нидерланды. Нидерланды являются стороной Конвенции Совета Европы ETS № 108 и обеспечивают адекватную защиту прав субъектов персональных данных в соответствии со ст. 12 152-ФЗ РФ и европейским регламентом GDPR. Хранение и трансграничная передача производятся на основании явного согласия пользователя.
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  1. Общие положения
                </h4>
                <p>
                  Настоящая Политика обработки персональных данных составлена в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» и определяет порядок сбора, хранения, защиты и обработки персональных данных пользователей сервиса «Дневник Диабета &amp; Самоконтроля» (домен <strong>gluco.zduben.ru</strong>).
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  2. Категории обрабатываемых данных (включая специальные категории)
                </h4>
                <p>
                  В рамках работы приложения обрабатываются следующие данные:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Учетная запись: логин (псевдоним) и криптографический хэш пароля (`scrypt`).</li>
                  <li>Идентификационные данные: имя или ФИО пациента (по желанию пользователя для отчетов врачу).</li>
                  <li>
                    <strong>Специальные категории персональных данных (ст. 10 152-ФЗ)</strong> — сведения о состоянии здоровья:
                    уровень глюкозы в крови, тип диабета, целевые диапазоны сахара, дозы введенного инсулина (РинФаст, Тресиба и аналоги), количество углеводов, ХЕ, калорий, заметки о самочувствии и физической активности.
                  </li>
                  <li>Технические данные: файлы cookie и записи LocalStorage для поддержания защищенной сессии.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  3. Правовые основания и цели обработки
                </h4>
                <p>
                  Обработка специальных категорий персональных данных и их трансграничная передача осуществляются исключительно на основании информированного согласия субъекта персональных данных (п. 1 ч. 2 ст. 10 и ст. 12 152-ФЗ РФ), выраженного при регистрации.
                </p>
                <p><strong>Цели обработки:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Предоставление пользователю функционала электронного дневника самоконтроля диабета.</li>
                  <li>Автоматический расчет ХЕ, суточных итогов, гликированного гемоглобина (HbA1c) и TIR (времени в целевом диапазоне).</li>
                  <li>Формирование медицинских отчетов в формате PDF и CSV для передачи лечащему врачу-эндокринологу.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  4. Защита, хранение и нераспространение данных
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Все данные шифруются при передаче по протоколу HTTPS с сертификатом SSL (TLS 1.2 / TLS 1.3).</li>
                  <li>Пароли никогда не хранятся в открытом виде — используется стойкое хэширование с солью.</li>
                  <li>
                    <strong>Данные никогда не передаются третьим лицам</strong>, рекламным сетям, аналитическим трекерам или страховым компаниям.
                  </li>
                  <li>Ежедневно в 00:00 по МСК создается резервная копия базы данных для защиты от сбоев.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  5. Использование Cookies и LocalStorage
                </h4>
                <p>
                  Сервис использует исключительно технические и строго необходимые файлы Cookie и хранилище LocalStorage:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><code>glucotrack_auth_token</code> — токен авторизации текущей сессии пользователя.</li>
                  <li><code>cookie_consent_accepted</code> — фиксация вашего согласия с уведомлением о cookie.</li>
                  <li>Локальный кэш записей — для предотвращения потери замеров при кратковременном обрыве интернета.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  6. Права субъекта персональных данных
                </h4>
                <p>
                  Пользователь имеет право в любой момент:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Выгрузить полную копию своих данных в файл формата JSON или Excel (.xlsx) через настройки.</li>
                  <li>Изменить или исправить любые внесенные замеры и настройки.</li>
                  <li>Полностью и безвозвратно удалить все записи дневника («Очистить дневник» в настройках).</li>
                  <li>Отозвать согласие на обработку данных, прекратив использование сервиса и запросив удаление аккаунта.</li>
                </ul>
              </section>
            </>
          ) : (
            <>
              {/* Медицинский дисклеймер */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/60 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-900 dark:text-amber-200 text-xs uppercase tracking-wide">
                    Важное медицинское предупреждение (323-ФЗ РФ)
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Веб-приложение «Дневник Диабета &amp; Самоконтроля» не является медицинским изделием, диагностической системой или назначением врача.
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  1. Назначение сервиса
                </h4>
                <p>
                  Сервис предназначен исключительно для самостоятельного ведения электронного журнала учета сахара крови, доз инсулина и питания пациентом, а также для наглядной демонстрации динамики лечащему врачу на очном приеме в соответствии с клиническими рекомендациями Минздрава РФ по сахарному диабету.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  2. Отказ от врачебной ответственности
                </h4>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Любые автоматические расчеты в программе (оценка уровня сахара, ХЕ, расчетный HbA1c, TIR) носят <strong>информационно-справочный характер</strong>.
                  </li>
                  <li>
                    Приложение <strong>не выдает прямых медицинских указаний</strong> по введению конкретных доз инсулина на коррекцию или еду.
                  </li>
                  <li>
                    <strong>Категорически запрещено</strong> самостоятельно менять базовую дозировку инсулинов (РинФаст, Тресиба и др.), схему инсулинотерапии или отменять препараты без предварительной очной консультации с вашим лечащим врачом-эндокринологом.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  3. Действия при жизнеугрожающих состояниях
                </h4>
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl space-y-1 text-red-800 dark:text-red-300">
                  <p className="font-bold">
                    При резком ухудшении самочувствия, тяжелой гипогликемии (&lt; 3.0 ммоль/л с потерей ориентации) или кетоацидозе (&gt; 14–16 ммоль/л с запахом ацетона):
                  </p>
                  <p>
                    Немедленно примите быстрые углеводы (при гипогликемии) и вызывайте скорую медицинскую помощь по телефонам <strong>103</strong> или <strong>112</strong>! Не полагайтесь на интерфейс приложения в экстренных ситуациях.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Данные защищены законодательством РФ</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            Понятно
          </button>
        </div>

      </div>
    </div>
  );
};
