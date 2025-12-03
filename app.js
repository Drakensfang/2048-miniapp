import { sdk } from '@farcaster/miniapp-sdk';
const TARGET_TILE = 2048;

(async function initApp(){
  try {
    await sdk.actions.ready();
  } catch (err) {
    // if SDK not present, continue — game still works offline
    console.warn("Farcaster SDK not available or ready failed:", err);
  }

  // DOM
  const boardEl = document.getElementById('board');
  const tileLayer = document.getElementById('tileLayer');
  const restartBtn = document.getElementById('restartBtn');
  const shareBtn = document.getElementById('shareBtn');
  const muteBtn = document.getElementById('muteBtn');
  const scoreValEl = document.getElementById('scoreVal');
  const bestValEl = document.getElementById('bestVal');
  const modalRoot = document.getElementById('modalRoot');

  // grid state
  let grid = [];
  const SIZE = 4;
  let score = 0;
  // migrate legacy best key to new key 'number_puzzle_best'
  let best = 0;
  try {
    const newBest = localStorage.getItem('number_puzzle_best');
    const legacyBest = localStorage.getItem('2048_best');
    if (newBest) {
      best = Number(newBest || 0);
    } else if (legacyBest) {
      best = Number(legacyBest || 0);
      localStorage.setItem('number_puzzle_best', best);
    }
  } catch (e) {
    best = 0;
  }

  bestValEl.textContent = best;

  // Sound Manager
  class SoundManager {
    constructor() {
      this.sounds = {
        move: new Audio('/sounds/move.mp3'),
        merge: new Audio('/sounds/merge.mp3'),
        gameover: new Audio('/sounds/gameover.mp3')
      };
      
      // Preload all sounds
      Object.values(this.sounds).forEach(sound => {
        sound.preload = 'auto';
        sound.volume = 0.5;
      });
      
      // Load mute preference from localStorage
      try {
        const mutePreference = localStorage.getItem('number_puzzle_muted');
        this.muted = mutePreference === 'true';
      } catch (e) {
        this.muted = false;
      }
      
      // Track last play time to prevent excessive overlapping
      this.lastPlayTime = {};
      this.minInterval = 50; // minimum ms between same sound plays
    }
    
    play(soundName) {
      if (this.muted) return;
      
      const sound = this.sounds[soundName];
      if (!sound) return;
      
      // Prevent excessive overlap
      const now = Date.now();
      if (this.lastPlayTime[soundName] && now - this.lastPlayTime[soundName] < this.minInterval) {
        return;
      }
      this.lastPlayTime[soundName] = now;
      
      // Clone and play to allow overlapping sounds when needed
      try {
        sound.currentTime = 0;
        sound.play().catch(err => {
          console.warn(`Failed to play ${soundName} sound:`, err);
        });
      } catch (err) {
        console.warn(`Error playing ${soundName} sound:`, err);
      }
    }
    
    setMuted(muted) {
      this.muted = muted;
      try {
        localStorage.setItem('number_puzzle_muted', muted);
      } catch (e) {
        console.warn('Failed to save mute preference:', e);
      }
    }
    
    isMuted() {
      return this.muted;
    }
  }
  
  const soundManager = new SoundManager();

  // tile visuals config
  const boardRect = boardEl.getBoundingClientRect();
  // tile cell size + gap must match CSS grid calculations
  function getCellSize() {
    const gap = 12; // matches CSS
    const totalGap = gap * (SIZE - 1);
    const inner = boardEl.clientWidth - totalGap - 24; // board padding 12px both sides
    const cell = Math.floor(inner / SIZE);
    return { cell, gap };
  }

  // helpers
  function createEmptyGrid(){
    grid = Array.from({length:SIZE}, ()=>Array.from({length:SIZE}, ()=>0));
  }

  function addRandomTile(){
    const empty = [];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(grid[r][c]===0) empty.push([r,c]);
    if(empty.length===0) return;
    const [r,c] = empty[Math.floor(Math.random()*empty.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    spawnTileVisual(r,c,grid[r][c],true);
  }

  function updateScore(delta){
    score += delta;
    scoreValEl.textContent = score;
    if(score > best){
      best = score;
      bestValEl.textContent = best;
      try { localStorage.setItem('number_puzzle_best', best); } catch(e) {}
    }
  }

  // visual layer: create, move, merge tiles as absolutely positioned elements
  const visuals = {}; // key id -> element
  let nextId = 1;

  function getTilePosition(r,c){
    const { cell, gap } = getCellSize();
    const left = c * (cell + gap);
    const top = r * (cell + gap);
    return { left, top, size: cell };
  }

  function spawnTileVisual(r,c,value,pop=false){
    const id = nextId++;
    const el = document.createElement('div');
    el.className = `tile v-${value}`;
    el.dataset.id = id;
    el.dataset.r = r; el.dataset.c = c;
    el.textContent = value;
    const pos = getTilePosition(r,c);
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
    el.style.width = pos.size + 'px';
    el.style.height = pos.size + 'px';
    tileLayer.appendChild(el);
    visuals[id] = el;
    if(pop) el.classList.add('pop');
    return id;
  }

  function moveVisual(id,toR,toC,delay=0){
    const el = visuals[id];
    if(!el) return;
    const pos = getTilePosition(toR,toC);
    // update dataset
    el.dataset.r = toR; el.dataset.c = toC;
    // animate by setting left/top
    requestAnimationFrame(()=> {
      el.style.left = pos.left + 'px';
      el.style.top = pos.top + 'px';
      el.style.width = pos.size + 'px';
      el.style.height = pos.size + 'px';
    });
  }

  function removeVisual(id){
    const el = visuals[id];
    if(!el) return;
    el.remove();
    delete visuals[id];
  }

  // build mapping from grid to visuals:
  // We'll store per-cell a visual id to track movement
  function syncVisualsFromGrid(prevMapping){
    // prevMapping: array same shape with visual ids (or null)
    // new grid has numbers; we will create new visuals or move existing ones
    // Strategy: naive re-create on each refresh for simplicity:
    // Remove all existing visuals and spawn new ones with pop animation
    Object.keys(visuals).forEach(removeVisual);
    for(let r=0;r<SIZE;r++){
      for(let c=0;c<SIZE;c++){
        const val = grid[r][c];
        if(val !== 0) spawnTileVisual(r,c,val,true);
      }
    }
  }

  // Game logic: slide/merge functions return whether something changed, and score gained
  function slideRowLeft(row){
    const arr = row.filter(v=>v!==0);
    let gained = 0;
    let merged = false;
    for(let i=0;i<arr.length-1;i++){
      if(arr[i] === arr[i+1]){
        arr[i] *= 2;
        gained += arr[i];
        arr.splice(i+1,1);
        merged = true;
      }
    }
    while(arr.length < SIZE) arr.push(0);
    return { newRow: arr, gained, merged };
  }

  function moveLeft(){
    let moved = false;
    let gain = 0;
    let hadMerge = false;
    for(let r=0;r<SIZE;r++){
      const { newRow, gained, merged } = slideRowLeft(grid[r]);
      if(!arraysEqual(newRow, grid[r])){
        moved = true;
        grid[r] = newRow;
        gain += gained;
        if(merged) hadMerge = true;
      }
    }
    if(gain>0) updateScore(gain);
    return { moved, hadMerge };
  }

  function moveRight(){
    // reverse each row, slide left, reverse back
    let moved = false;
    let gain = 0;
    let hadMerge = false;
    for(let r=0;r<SIZE;r++){
      const rev = [...grid[r]].reverse();
      const { newRow, gained, merged } = slideRowLeft(rev);
      const out = newRow.reverse();
      if(!arraysEqual(out, grid[r])){
        moved = true; grid[r] = out; gain += gained;
        if(merged) hadMerge = true;
      }
    }
    if(gain>0) updateScore(gain);
    return { moved, hadMerge };
  }

  function transpose(m){
    return m[0].map((_,i)=>m.map(row=>row[i]));
  }

  function moveUp(){
    grid = transpose(grid);
    const result = moveLeft();
    grid = transpose(grid);
    return result;
  }

  function moveDown(){
    grid = transpose(grid);
    const result = moveRight();
    grid = transpose(grid);
    return result;
  }

  function arraysEqual(a,b){
    return a.length === b.length && a.every((v,i)=>v===b[i]);
  }

  function hasMoves(){
    // if any zero exists -> moves
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(grid[r][c]===0) return true;
    // check neighbors
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE-1;c++) if(grid[r][c]===grid[r][c+1]) return true;
    for(let c=0;c<SIZE;c++) for(let r=0;r<SIZE-1;r++) if(grid[r][c]===grid[r+1][c]) return true;
    return false;
  }

  function checkWin(){
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(grid[r][c]===TARGET_TILE) return true;
    return false;
  }

  // Input handling
  let startX=null, startY=null;
  function handleMove(makeMove){
    const result = makeMove();
    if(result.moved){
      // Play appropriate sound
      if(result.hadMerge){
        soundManager.play('merge');
      } else {
        soundManager.play('move');
      }
      
      render(); // re-render visuals
      setTimeout(()=> {
        addRandomTile();
        render();
        if(checkWin()) showModal('You win 🎉', 'You reached the target tile!', true);
        else if(!hasMoves()) {
          soundManager.play('gameover');
          showModal('Game Over', 'No more moves available.', false);
        }
      }, 160); // wait for animation
    }
  }

  document.addEventListener('keydown', (e) => {
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault();
    switch(e.key){
      case 'ArrowLeft': handleMove(moveLeft); break;
      case 'ArrowRight': handleMove(moveRight); break;
      case 'ArrowUp': handleMove(moveUp); break;
      case 'ArrowDown': handleMove(moveDown); break;
    }
  });

  // touch
  boardEl.addEventListener('touchstart', (e)=>{
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
  });

  boardEl.addEventListener('touchend', (e)=>{
    if(startX === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const threshold = 30;
    if(Math.max(absX,absY) < threshold){ startX=null; startY=null; return; }
    if(absX > absY){
      if(dx > 0) handleMove(moveRight); else handleMove(moveLeft);
    } else {
      if(dy > 0) handleMove(moveDown); else handleMove(moveUp);
    }
    startX = null; startY = null;
  });

  // share function: Web Share API -> Farcaster SDK if available -> clipboard fallback
  async function shareScore(){
    const text = `I scored ${score} in Number Puzzle Game — can you beat me?`;
    try {
      if(navigator.share){
        await navigator.share({ title: 'Number Puzzle Game', text, url: location.href });
        return;
      }
      // try Farcaster SDK share action if available
      if(sdk && sdk.actions && typeof sdk.actions.share === 'function'){
        await sdk.actions.share({ text });
        return;
      }
      // fallback: copy to clipboard
      await navigator.clipboard.writeText(text);
      alert('Score copied to clipboard. Share it anywhere!');
    } catch (err){
      console.warn('Share failed', err);
      try { await navigator.clipboard.writeText(text); alert('Score copied to clipboard.'); } catch(e){ alert('Could not share.'); }
    }
  }

  shareBtn.addEventListener('click', shareScore);
  restartBtn.addEventListener('click', () => {
    score = 0; scoreValEl.textContent = 0;
    initNewGame();
  });

  // Mute button functionality
  function updateMuteButton() {
    if (muteBtn) {
      muteBtn.textContent = soundManager.isMuted() ? '🔇' : '🔊';
      muteBtn.title = soundManager.isMuted() ? 'Unmute sounds' : 'Mute sounds';
    }
  }
  
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      soundManager.setMuted(!soundManager.isMuted());
      updateMuteButton();
    });
    updateMuteButton(); // Initialize button state
  }

  // modal helper
  function showModal(title, text, isWin){
    modalRoot.innerHTML = `
      <div class="modal" id="dialogRoot">
        <div class="dialog">
          <h2>${title}</h2>
          <p>${text}</p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
            <button id="modalRestart" class="button primary">Restart</button>
            <button id="modalShare" class="button">Share</button>
            <button id="modalClose" class="button">Close</button>
          </div>
        </div>
      </div>
    `;
    modalRoot.style.display = 'block';
    document.getElementById('modalRestart').addEventListener('click', ()=>{ modalRoot.style.display='none'; initNewGame(); });
    document.getElementById('modalShare').addEventListener('click', ()=>{ shareScore(); });
    document.getElementById('modalClose').addEventListener('click', ()=>{ modalRoot.style.display='none'; });
  }

  // Render: recalc visual positions, create/remove visuals as needed
  function render(){
    // simple approach: clear visuals and recreate (keeps code simpler)
    tileLayer.innerHTML = '';
    Object.keys(visuals).forEach(k => delete visuals[k]); // clear visuals map
    for(let r=0;r<SIZE;r++){
      for(let c=0;c<SIZE;c++){
        const val = grid[r][c];
        if(val!==0) spawnTileVisual(r,c,val,false);
      }
    }
  }


  // initialize new game
  function initNewGame(){
    createEmptyGrid();
    score = 0; scoreValEl.textContent = 0;
    addRandomTile();
    addRandomTile();
    render();
  }

  // on load, initialize
  initNewGame();

  // handle window resize to reposition tiles
  window.addEventListener('resize', () => {
    render();
  });

  // helper to detect win/over after every move is handled; integrated in handleMove

})();
