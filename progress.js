// Shared, DOM-independent daily completion rules. QT verses never count as read chapters.
const DailyProgress = (() => {
  // 'either' is only retained to evaluate historical daily snapshots.
  const rules = ['both', 'either', 'qt', 'reading'];
  function settings(value = {}) {
    const goal = Number(value.dailyGoal);
    return {
      dailyGoal: Number.isInteger(goal) && goal >= 1 && goal <= 1189 ? goal : 1,
      completionRule: rules.includes(value.completionRule) ? value.completionRule : 'qt',
      skipSundayQt: value.skipSundayQt === true
    };
  }
  function state(date, qtDone, chapterCount, value) {
    const config = settings(value);
    const qtOff = config.skipSundayQt && new Date(date + 'T12:00:00+09:00').getUTCDay() === 0;
    const readingDone = chapterCount >= config.dailyGoal;
    const rest = qtOff && config.completionRule === 'qt';
    const complete = !rest && ({
      both: (qtOff || qtDone) && readingDone,
      either: (!qtOff && qtDone) || readingDone,
      qt: qtDone,
      reading: readingDone
    })[config.completionRule];
    return { complete: Boolean(complete), rest, qtOff, readingDone };
  }
  function streak(today, status, shiftDay) {
    let date = status(today).complete || status(today).rest ? today : shiftDay(today, -1);
    let count = 0;
    for (let i = 0; i < 40000; i++) {
      const day = status(date);
      if (!day.complete && !day.rest) break;
      if (day.complete) count++;
      date = shiftDay(date, -1);
    }
    return count;
  }
  return { settings, state, streak };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DailyProgress;
