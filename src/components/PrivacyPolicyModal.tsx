import React from 'react';
import { ShieldCheck, Lock, AlertTriangle, Database, CheckCircle2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Правовая информация и конфиденциальность"
      subtitle="Соответствие законодательству РФ (152-ФЗ и 323-ФЗ)"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {/* Tab Switch */}
        <div
          role="tablist"
          aria-label="Разделы правовой информации"
          className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'policy'}
            onClick={() => setActiveTab('policy')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors min-h-[38px] flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'policy'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Обработка данных (152-ФЗ)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'medical'}
            onClick={() => setActiveTab('medical')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors min-h-[38px] flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'medical'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Медицинский отказ (323-ФЗ)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="space-y-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
          {activeTab === 'policy' ? (
            <>
              {/* Server in Netherlands block */}
              <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 flex items-start gap-3">
                <Database className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-white text-xs">
                    Защита персональных данных (152-ФЗ РФ / GDPR)
                  </div>
                  <p className="text-[11px] text-teal-900 dark:text-teal-200">
                    Серверное оборудование и база данных защищены в соответствии с Конвенцией Совета Европы ETS № 108, ст. 12 152-ФЗ РФ и регламентом GDPR. Хранение данных производится на основании согласия пользователя при регистрации.
                  </p>
                </div>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  1. Общие положения
                </h4>
                <p>
                  Настоящая Политика обработки персональных данных составлена в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» и определяет порядок сбора, хранения, защиты и обработки данных пользователей сервиса «Дневник Диабета &amp; Самоконтроля» (GlucoTrack).
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  2. Категории обрабатываемых данных
                </h4>
                <p>
                  В рамках работы приложения обрабатываются следующие категории информации:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Учетная запись: логин (псевдоним) и криптографический хэш пароля.</li>
                  <li>Идентификационные данные: имя или ФИО пациента (по желанию пользователя для отчетов лечащему врачу).</li>
                  <li>
                    <strong>Специальные категории данных (ст. 10 152-ФЗ)</strong> — сведения о состоянии здоровья: уровень гликемии, целевые диапазоны, дозы введенных инсулинов (РинФаст, Тресиба и аналоги), количество углеводов, ХЕ, калорий, заметки о самочувствии и физической активности.
                  </li>
                  <li>Технические данные: файлы cookie и LocalStorage для поддержания защищенной сессии.</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  3. Правовые основания и цели обработки
                </h4>
                <p>
                  Обработка специальных категорий персональных данных осуществляется на основании информированного согласия субъекта (ст. 10 и ст. 12 152-ФЗ РФ).
                </p>
                <p><strong>Цели обработки:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Предоставление пользователю функционала электронного дневника самоконтроля диабета.</li>
                  <li>Расчет ХЕ, суточных итогов, расчетного HbA1c и доли измерений в целевом диапазоне.</li>
                  <li>Формирование медицинских отчетов в формате PDF и XLSX для передачи лечащему врачу-эндокринологу.</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  4. Защита и резервное копирование
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Все данные шифруются при передаче по протоколу HTTPS (TLS 1.2 / TLS 1.3).</li>
                  <li>Пароли не хранятся в открытом виде — используется стойкое хэширование с солью (`scrypt`).</li>
                  <li>
                    <strong>Данные никогда не передаются третьим лицам</strong>, рекламным сетям или аналитическим трекерам.
                  </li>
                  <li>Ежедневно в 00:00 по МСК создается резервная копия базы данных SQLite.</li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  5. Права субъекта персональных данных
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Выгрузка полной копии данных в формате XLSX через настройки.</li>
                  <li>Изменение или корректировка любых внесенных записей.</li>
                  <li>Полное и безвозвратное удаление всех замеров («Очистить дневник» в настройках).</li>
                </ul>
              </section>
            </>
          ) : (
            <>
              {/* Medical warning block */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-900 dark:text-amber-200 text-xs">
                    Важное медицинское уведомление (323-ФЗ РФ)
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Веб-приложение «Дневник Диабета &amp; Самоконтроля» не является медицинским изделием, автоматизированной диагностической системой или назначением врача.
                  </p>
                </div>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  1. Назначение сервиса
                </h4>
                <p>
                  Сервис предназначен для самостоятельного ведения журнала самоконтроля гликемии, доз инсулинов и питания, а также для наглядной демонстрации динамики лечащему врачу на очном приеме в соответствии с клиническими рекомендациями Минздрава РФ по сахарному диабету.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  2. Отказ от врачебной ответственности
                </h4>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Любые расчетные показатели в программе (оценка уровня сахара, ХЕ, ориентировочный eHbA1c, доля измерений в диапазоне) носят <strong>информационно-справочный характер</strong>.
                  </li>
                  <li>
                    Приложение <strong>не выдает прямых медицинских указаний</strong> по коррекции доз инсулина на еду или понижение сахара.
                  </li>
                  <li>
                    <strong>Запрещено</strong> самостоятельно изменять базовую дозировку инсулинов (РинФаст, Тресиба и др.), схему инсулинотерапии или отменять препараты без очной консультации с вашим лечащим врачом-эндокринологом.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                  3. Действия при жизнеугрожающих состояниях
                </h4>
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl space-y-1 text-rose-800 dark:text-rose-200">
                  <p className="font-semibold">
                    При резком ухудшении самочувствия, тяжелой гипогликемии (&lt; 3.0 ммоль/л с потерей ориентации) или подозрении на кетоацидоз (&gt; 13–15 ммоль/л):
                  </p>
                  <p className="text-[11px]">
                    Немедленно примите быстрые углеводы (при гипогликемии) и вызывайте скорую медицинскую помощь по телефонам <strong>103</strong> или <strong>112</strong>! Не полагайтесь на интерфейс приложения в экстренных ситуациях.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Конфиденциальность 152-ФЗ РФ</span>
          </div>

          <Button type="button" variant="primary" size="md" onClick={onClose}>
            Понятно
          </Button>
        </div>
      </div>
    </Modal>
  );
};
