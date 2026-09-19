"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import avatarCatalogue from '@/lib/avatars.json';
import { elapsed, formatTime, normalize, type Difficulty, type Run } from '@/lib/game';
import { leaderboardCategory, leaderboardDifficulties, leaderboardRegions, type Avatar, type LeaderboardEntry, type LeaderboardPage, type RegionCategory, type SubmissionResult } from '@/lib/leaderboard';

const avatars: Avatar[] = avatarCatalogue;
const avatarMap = new Map(avatars.map(avatar => [avatar.key, avatar]));

function AvatarSprite({ avatar }: { avatar: Avatar }) {
  return <picture><source media="(prefers-reduced-motion: reduce)" srcSet={avatar.still}/><img className="avatar-sprite" src={avatar.animated} alt="" width={32} height={32} loading="lazy"/></picture>;
}

export function Leaderboard({ initialCategory, initialDifficulty, run, submissionId, outcome, onSubmitted, onMainMenu, onBack, onUiSound }: {
  initialCategory: RegionCategory; initialDifficulty: Difficulty; run: Run | null; submissionId: string;
  outcome: SubmissionResult | null; onSubmitted: (result: SubmissionResult) => void;
  onMainMenu: () => void; onBack?: () => void; onUiSound: () => void;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('000MS');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const avatarList = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const saveBusy = useRef(false);
  const [findEntry, setFindEntry] = useState<number | null>(outcome?.entryId ?? null);
  const [located, setLocated] = useState(false);
  const runCategory = run ? leaderboardCategory(run.generationIds) : null;
  const canSubmit = !!run && run.status !== 'playing' && !!runCategory && !outcome;
  const query = normalize(search);
  const filteredAvatars = avatars.filter(item => !query || normalize(item.name).includes(query) || String(item.id).padStart(3, '0').includes(query));

  const load = useCallback(async (after: string | null, replace = false) => {
    if (busy.current && !replace) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    busy.current = true;
    setLoading(true); setLoadError('');
    try {
      const params = new URLSearchParams({ category, difficulty });
      if (after) params.set('cursor', after);
      const response = await fetch(`/api/leaderboard?${params}`, { signal: controller.signal });
      const data = await response.json() as LeaderboardPage & { error?: string };
      if (!response.ok) throw new Error(data.error || 'The leaderboard could not load.');
      if (controller.signal.aborted) return;
      setEntries(previous => replace ? data.entries : [...previous, ...data.entries.filter(entry => !previous.some(old => old.id === entry.id))]);
      setCursor(data.nextCursor); setTotal(data.total);
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'The leaderboard could not load.');
    } finally {
      if (!controller.signal.aborted) { busy.current = false; setLoading(false); }
    }
  }, [category, difficulty]);

  useEffect(() => {
    setEntries([]); setCursor(null); setTotal(0); setLocated(false);
    if (list.current) list.current.scrollTop = 0;
    void load(null, true);
    return () => { request.current?.abort(); busy.current = false; };
  }, [load, revision]);

  useEffect(() => {
    if (!cursor || loading || loadError) return;
    const observer = new IntersectionObserver(records => {
      if (records.some(record => record.isIntersecting)) void load(cursor);
    }, { root: list.current, rootMargin: '0px 0px 240px 0px' });
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor, load, loading, loadError]);

  useEffect(() => {
    if (busy.current || !findEntry || located || loading || loadError) return;
    const row = list.current?.querySelector<HTMLElement>(`[data-entry="${findEntry}"]`);
    if (row && list.current) {
      list.current.scrollTop += row.getBoundingClientRect().top - list.current.getBoundingClientRect().top - 54;
      setLocated(true);
    } else if (cursor) void load(cursor);
    else setLocated(true);
  }, [findEntry, located, entries, cursor, loading, loadError, load]);

  const changeCategory = (next: RegionCategory) => { onUiSound(); setFindEntry(null); setCategory(next); };
  const changeDifficulty = (next: Difficulty) => { onUiSound(); setFindEntry(null); setDifficulty(next); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !run || saveBusy.current) return;
    if (!name.trim() || [...name.trim()].length > 10) { setSaveError('Enter a name of 1–10 characters.'); return; }
    onUiSound(); saveBusy.current = true; setSaving(true); setSaveError('');
    try {
      const response = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        runId: submissionId, category: runCategory, difficulty: run.difficulty, name: name.trim(), avatar,
        correct: Object.keys(run.revealed).length, elapsedMs: Math.floor(elapsed(run, run.endedAt ?? 0)), status: run.status,
      }) });
      const result = await response.json() as SubmissionResult & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Your score could not be saved.');
      onSubmitted(result); setCategory(runCategory!); setDifficulty(run.difficulty);
      setFindEntry(result.entryId); setRevision(value => value + 1);
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Your score could not be saved. Please try again.'); }
    finally { saveBusy.current = false; setSaving(false); }
  };

  return <section className="leaderboard-screen" aria-labelledby="leaderboard-title">
    <div className="leaderboard-heading site-title-row"><h1 id="leaderboard-title">Gotta name 'em all!</h1><button className="primary-button red-action" onClick={onMainMenu} disabled={saving}>MAIN MENU</button></div>
    {onBack && <button className="text-button leaderboard-back" onClick={onBack} disabled={saving}>Back to results</button>}
    <div className="leaderboard-layout">
      {canSubmit && <form className="leaderboard-submit pixel-panel" onSubmit={submit}>
        <h2>Leaderboard submission</h2>
        <p className="submission-category">{leaderboardRegions.find(region => region.id === runCategory)?.label}<br/>{leaderboardDifficulties.find(d => d.id === run?.difficulty)?.label}</p>
        <div className="submission-score"><div><span>POKÉMON</span><strong>{Object.keys(run!.revealed).length} / {run!.pokemon.length}</strong></div><div><span>TIME</span><strong>{formatTime(elapsed(run!, run!.endedAt ?? 0))}</strong></div></div>
        <label className="leaderboard-field" htmlFor="trainer-name">Name:</label>
        <input id="trainer-name" value={name} onChange={event => setName([...event.target.value].slice(0, 10).join(''))} required autoComplete="nickname" placeholder="Max 10 chars" disabled={saving}/>
        <label className="leaderboard-field" htmlFor="avatar-search">Pokémon:</label>
        <p className="avatar-explainer">This Pokémon will be displayed with you on the leaderboard</p>
        <div className="chosen-avatar"><AvatarSprite avatar={avatarMap.get(avatar)!}/><span>{avatarMap.get(avatar)!.name}</span></div>
        <input id="avatar-search" type="search" placeholder="Search name or number…" value={search} onChange={event => { setSearch(event.target.value); if (avatarList.current) avatarList.current.scrollTop = 0; }} disabled={saving}/>
        <div className="avatar-picker" ref={avatarList} role="group" aria-label="Pokémon avatars">
          {filteredAvatars.map(item => <button type="button" key={item.key} className={'avatar-choice' + (avatar === item.key ? ' selected' : '')} aria-pressed={avatar === item.key} onClick={() => { onUiSound(); setAvatar(item.key); }} disabled={saving}><AvatarSprite avatar={item}/><span><small>{String(item.id).padStart(3, '0')}</small>{item.name}</span></button>)}
          {!filteredAvatars.length && <p className="leaderboard-message">No Pokémon found.</p>}
        </div>
        {saveError && <p role="alert" className="leaderboard-error">{saveError}</p>}
        <button className="primary-button red-action submit-score" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit to Leaderboard'}</button>
        <button type="button" className="text-button" onClick={onBack || onMainMenu} disabled={saving}>Cancel</button>
      </form>}
      <div className="leaderboard-standings">
        {outcome && !(outcome.accepted && outcome.entryId) && <p className="submission-notice" role="status">{outcome.accepted ? 'Your score was submitted. It is no longer in the top 999.' : 'Your score didn’t make the top 999.'}</p>}
        <fieldset className="leaderboard-filters"><legend className="leaderboard-visually-hidden">Regions</legend>{leaderboardRegions.map(region => <button key={region.id} type="button" className={'leaderboard-choice' + (category === region.id ? ' selected' : '')} aria-pressed={category === region.id} onClick={() => changeCategory(region.id)}>{region.label}</button>)}</fieldset>
        <fieldset className="leaderboard-filters difficulty-filters"><legend className="leaderboard-visually-hidden">Difficulty</legend>{leaderboardDifficulties.map(item => <button key={item.id} type="button" className={'leaderboard-choice' + (difficulty === item.id ? ' selected' : '')} aria-pressed={difficulty === item.id} onClick={() => changeDifficulty(item.id)}>{item.label}</button>)}</fieldset>
        <div className="dex-leaderboard-frame">
          <div className="dex-list-title">LEADERBOARD</div>
          <div className="leaderboard-scroll" ref={list} tabIndex={0} role="region" aria-label="Leaderboard standings, scroll for more entries" aria-busy={loading}>
            <table className="leaderboard-table"><thead><tr><th scope="col">RANK</th><th scope="col"><span className="leaderboard-visually-hidden">Pokémon</span><span className="pkmn-heading" aria-hidden="true"><span>P</span><span>K</span><span>M</span><span>N</span></span></th><th scope="col">NAME</th><th scope="col">POKéMON</th><th scope="col">TIME</th></tr></thead>
              <tbody>{entries.map(entry => <tr key={entry.id} data-entry={entry.id} className={entry.id === outcome?.entryId ? 'own-entry' : ''}><td>{String(entry.rank).padStart(3, '0')}</td><td><AvatarSprite avatar={avatarMap.get(entry.avatar) || avatars[0]}/></td><td className="trainer-name">{entry.name}</td><td>{entry.correct}</td><td>{formatTime(entry.elapsedMs)}</td></tr>)}</tbody>
            </table>
            {!loading && !loadError && !entries.length && <p className="leaderboard-message">No leaderboard submissions!</p>}
            {loadError && <div className="leaderboard-message" role="alert"><p>{loadError}</p><button className="text-button" onClick={() => void load(cursor, !entries.length)}>Try again</button></div>}
            {loading && <p className="leaderboard-message" role="status">Loading entries…</p>}
            <div ref={sentinel} className="leaderboard-sentinel" aria-hidden="true"/>
          </div>
          <div className="dex-list-footer" aria-hidden="true" />
        </div>
      </div>
    </div>
  </section>;
}
