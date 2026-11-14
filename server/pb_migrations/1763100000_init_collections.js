/// <reference path="../pb_data/types.d.ts" />

// Anonymous game data for HOME BY SEVEN. The game may only create records; only the superuser
// (admin UI /_/) can list, read, change or delete them. No names, no free text typed by children.
migrate(
  (app) => {
    const common = [
      { name: 'device', type: 'text', required: true, min: 6, max: 64 },
      { name: 'lang', type: 'select', maxSelect: 1, values: ['en', 'uz', 'ru'] },
      { name: 'level', type: 'select', maxSelect: 1, values: ['cadet', 'pilot', 'commander'] },
      { name: 'app', type: 'text', max: 40 },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    ];

    // Three questions asked before the first game and again after it (concept 3.0, section 04):
    // gravity, air, radiation. `answers` = chosen option id per question; `correct` = how many were right.
    const playtests = new Collection({
      type: 'base',
      name: 'playtests',
      listRule: null,
      viewRule: null,
      createRule: '',
      updateRule: null,
      deleteRule: null,
      fields: [
        ...common,
        { name: 'phase', type: 'select', required: true, maxSelect: 1, values: ['before', 'after'] },
        { name: 'answers', type: 'json', maxSize: 2000 },
        { name: 'correct', type: 'number', min: 0, max: 3 },
        { name: 'session', type: 'text', max: 64 },
      ],
      indexes: ['CREATE INDEX idx_playtests_session ON playtests (session)'],
    });
    app.save(playtests);

    // One summary per finished game: which real week, scores, title, and the choices that led there.
    const runs = new Collection({
      type: 'base',
      name: 'runs',
      listRule: null,
      viewRule: null,
      createRule: '',
      updateRule: null,
      deleteRule: null,
      fields: [
        ...common,
        { name: 'week', type: 'text', required: true, max: 10 },
        { name: 'crew', type: 'number', min: 0, max: 10 },
        { name: 'science', type: 'number', min: 0, max: 100 },
        { name: 'title', type: 'text', max: 40 },
        { name: 'guesses', type: 'number', min: 0, max: 7 },
        { name: 'summary', type: 'json', maxSize: 20000 },
        { name: 'duration', type: 'number', min: 0 },
      ],
      indexes: ['CREATE INDEX idx_runs_week ON runs (week)'],
    });
    app.save(runs);
  },
  (app) => {
    for (const name of ['runs', 'playtests']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
