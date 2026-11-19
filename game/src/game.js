
(function(){
"use strict";
/* DIAGNOSA: tangkap semua error ke overlay di layar (bukan cuma console) */
var lastError="—";
window.addEventListener("error",function(e){ lastError="JS: "+(e.message||"error")+" (baris "+(e.lineno||"?")+")"; if(typeof dbgUpdate==="function") dbgUpdate(true); });
window.addEventListener("unhandledrejection",function(e){ lastError="Promise: "+((e.reason&&e.reason.message)||e.reason||"rejected"); if(typeof dbgUpdate==="function") dbgUpdate(true); });
if(typeof THREE==="undefined"){ lastError="THREE tidak terdefinisi"; }
var hasSave=false, saveData=null;
var money=250, health=100, wanted=0, missionIdx=0, weaponIdx=0;
var weapons=["Tinju","Pisau","Pistol","SMG","Shotgun"];
/* TOKO SEJA — katalog & inventaris. Harga diseimbangkan ke hadiah misi ($450/$700/$600/$900/$1500):
   Pisau terjangkau dari uang awal $250, Pistol setelah misi 1, mobil pertama setelah ~2 misi, Sport mendekati akhir cerita. */
var SHOP_WEAPONS=[
 {id:"Pisau",price:120,desc:"Senjata dingin, senyap, tanpa amunisi.",startAmmo:0},
 {id:"Pistol",price:350,desc:"Andalan jarak menengah. Termasuk 24 peluru.",startAmmo:24},
 {id:"Shotgun",price:650,desc:"Daya hancur besar di jarak dekat. Termasuk 16 selongsong.",startAmmo:16},
 {id:"SMG",price:800,desc:"Tembakan paling cepat. Termasuk 60 peluru.",startAmmo:60}
];
var SHOP_AMMO=[
 {id:"Pistol",label:"Peluru Pistol ×12",price:40,n:12},
 {id:"Shotgun",label:"Selongsong Shotgun ×8",price:55,n:8},
 {id:"SMG",label:"Peluru SMG ×30",price:60,n:30}
];
var SHOP_CARS=[
 {id:"sedan",name:"Sedan Kota",price:900,color:0x1e88e5,maxSpd:26,desc:"Mobil pribadi pertamamu. Kecepatan standar."},
 {id:"sport",name:"Sport Senja GT",price:2400,color:0xff2e88,maxSpd:35,desc:"Jauh lebih kencang — enak buat kabur dari polisi."}
];
var OUTFITS=[
 {id:"santai",name:"Setelan Santai",price:0,shirt:0xff5e3a,pants:0x223366,desc:"Pakaian awal Rico."},
 {id:"pantai",name:"Baju Pantai",price:90,shirt:0xffd166,pants:0x2e9e4f,desc:"Kuning cerah ala Marina."},
 {id:"neon",name:"Jaket Neon",price:150,shirt:0x00b8c9,pants:0x141824,desc:"Menyala di Neon Strip."},
 {id:"azura",name:"Setelan Azura",price:300,shirt:0x171a21,pants:0x171a21,desc:"Hitam elegan ala sindikat."}
];
var ownedWeapons=[true,false,false,false,false]; /* sejajar dengan weapons[]; hanya Tinju yang dimiliki di awal */
var ammo={Pistol:0,SMG:0,Shotgun:0};
var ownedCars=[], ownedOutfits=["santai"], currentOutfit="santai";
var inCar=null, camMode="chase", radioIdx=0, lightsOn=false, gameStarted=false, paused=false;
/* TAHAP 5 (lanjutan) — PENGATURAN sebagai state tersimpan: kualitas, volume musik/ambient, kamera, getaran.
   Semua ikut ditulis ke save (lihat captureSettings/persistSave) dan dipulihkan saat Continue. */
var qualityLow=false, musicVol=70, ambVol=60, vibOn=true;
var _vibOrig=(typeof navigator!=="undefined"&&typeof navigator.vibrate==="function")? navigator.vibrate.bind(navigator) : null;
if(_vibOrig){ try{ navigator.vibrate=function(p){ if(!vibOn) return false; return _vibOrig(p); }; }catch(e){} } /* getaran dibungkus sekali di sini: semua panggilan navigator.vibrate yang lama otomatis menghormati pengaturan Getaran */
var autoAim=true, aimTarget=null, aimLockUntil=0, aimFaceTo=null, aimFaceT=0; /* TAHAP 1: auto-aim (toggle di Settings, default NYALA) + target yang sedang dikunci cincin penanda */
var radios=["SEJA FM — Funk 98.1","NEON WAVE — Synth 101.3","AZURA RADIO — Pantai 88.7","OFF"];
var missions=[
 {t:"SAMBUTAN HANGAT",d:"Pergi ke dermaga. Dekati paketnya atau tekan B di dekat paket untuk mengambilnya.",x:-52,z:52,r:450},
 {t:"ANTAR CEPAT",d:"Antar paket ke Neon Strip NAIK MOBIL sebelum waktu habis!",x:48,z:42,r:700},
 {t:"KEJAR MENTARI",d:"Wanted 3 bintang! Kabur ke Taman Senja, dan misi hanya selesai bila wanted sudah 0 bintang.",x:-18,z:-54,r:600},
 {t:"UTANG LAMA",d:"Temui informan di Bukit Halcyon, gedung hotel besar.",x:52,z:-52,r:900},
 {t:"BALAS DENDAM",d:"Di pelabuhan: kalahkan 6 anggota Azura, lalu hadapi BOS Azura. Misi selesai saat bos tumbang.",x:-48,z:48,r:1500}
];
/* TAHAP 1 — state misi nyata */
var hasPackage=false, missionTimer=null, dialogueActive=false, dialogueIdx=0, pkgMesh=null, pkgPos=null, informantMesh=null, informantPos=null, azura=[], bossActive=false, gameFinished=false, failShowing=false, azuraToastAt=0, m5Restore=null, restoredM5Down=0;
var DIALOG_M4=[
 ["INFORMAN","Rico Vega… akhirnya kau berani datang juga. Azura sudah mengira kau kabur dari pulau ini."],
 ["RICO","Potong omong kosongnya. Aku ke sini bukan buat nostalgia. Di mana markas mereka sekarang?"],
 ["INFORMAN","Pelabuhan. Gudang lama di dermaga barat. Enam orang menjaga pintu… dan bos mereka menunggu di dalam."],
 ["RICO","Enam penjaga dan satu bos. Bagus — utangku lunas malam ini juga."],
 ["INFORMAN","Hati-hati, Rico. Kalau bos Azura tumbang, kota ini bebas. Kalau kau yang tumbang… tidak ada yang menolongmu."]
];
/* AUDIO */
var AC=null,musicGain,ambGain,sfxGain=null,sfxNoiseBuf=null,musicTimer=null,noteStep=0;
function initAudio(){ if(AC) return; try{ AC=new (window.AudioContext||window.webkitAudioContext)(); musicGain=AC.createGain(); musicGain.gain.value=musicVol/100*.5; musicGain.connect(AC.destination); ambGain=AC.createGain(); ambGain.gain.value=ambVol/100*.45; ambGain.connect(AC.destination); sfxGain=AC.createGain(); sfxGain.gain.value=.9; sfxGain.connect(AC.destination); /* TAHAP 5: bus gain KHUSUS efek suara (ledakan/tembakan/sirene/benturan), terpisah dari musik & ambient */
 // ocean ambient: filtered noise loop
 var len=2*AC.sampleRate, buf=AC.createBuffer(1,len,AC.sampleRate), d=buf.getChannelData(0); for(var i=0;i<len;i++) d[i]=Math.random()*2-1;
 var src=AC.createBufferSource(); src.buffer=buf; src.loop=true; var f=AC.createBiquadFilter(); f.type="lowpass"; f.frequency.value=420; var lfo=AC.createOscillator(); lfo.frequency.value=.12; var lg=AC.createGain(); lg.gain.value=180; lfo.connect(lg); lg.connect(f.frequency); src.connect(f); f.connect(ambGain); src.start(); lfo.start();
 startMusic(); }catch(e){} }
function beep(freq,dur,type,vol,when){ if(!AC) return; var o=AC.createOscillator(),g=AC.createGain(); o.type=type||"sine"; o.frequency.value=freq; g.gain.value=vol||.15; o.connect(g); g.connect(musicGain); var t=AC.currentTime+(when||0); g.gain.setValueAtTime(vol||.15,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); o.start(t); o.stop(t+dur); }
function horn(){ beep(370,.35,"square",.22); beep(466,.35,"square",.18); if(navigator.vibrate) navigator.vibrate(60); }
/* TAHAP 5 (lanjutan) — EFEK SUARA KHUSUS (SFX) sintetis Web Audio, TANPA file audio:
   LEDAKAN, TEMBAKAN (beda per senjata), SIRENE, dan BENTURAN kini punya sintesis & bus gain
   SENDIRI (sfxGain, terpisah dari musik radio & ambient ombak) supaya karakternya jelas beda
   dan tidak tertutup musik. Buffer noise 1 detik dibuat SEKALI lalu dipakai ulang (pooling). */
function sfxNoise(){ if(sfxNoiseBuf) return sfxNoiseBuf; var len=AC.sampleRate; sfxNoiseBuf=AC.createBuffer(1,len,AC.sampleRate); var d=sfxNoiseBuf.getChannelData(0); for(var i=0;i<len;i++) d[i]=Math.random()*2-1; return sfxNoiseBuf; }
function sfxNoiseBurst(dur,fType,fFrom,fTo,vol,when){ var t=AC.currentTime+(when||0); var src=AC.createBufferSource(); src.buffer=sfxNoise(); src.loop=true; var f=AC.createBiquadFilter(); f.type=fType; f.frequency.setValueAtTime(fFrom,t); f.frequency.exponentialRampToValueAtTime(Math.max(30,fTo),t+dur); var g=AC.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); src.connect(f); f.connect(g); g.connect(sfxGain||AC.destination); src.start(t); src.stop(t+dur+.05); }
function sfxTone(fFrom,fTo,dur,type,vol,when){ var t=AC.currentTime+(when||0); var o=AC.createOscillator(), g=AC.createGain(); o.type=type; o.frequency.setValueAtTime(fFrom,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,fTo),t+dur); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); o.connect(g); g.connect(sfxGain||AC.destination); o.start(t); o.stop(t+dur+.05); }
function sfxExplosion(){ if(!AC) return; try{ sfxNoiseBurst(.75,"lowpass",3200,90,.95); sfxNoiseBurst(.18,"highpass",900,2400,.35); sfxTone(120,27,.65,"sine",.8); sfxTone(64,24,.9,"triangle",.5,.05); }catch(e){} } /* LEDAKAN: dentuman noise menyapu turun + sub-bass jatuh 120→27 Hz */
function sfxGunshot(w,vol){ if(!AC) return; var v=vol||1; try{ if(w==="Shotgun"){ sfxNoiseBurst(.34,"lowpass",1500,140,.85*v); sfxTone(95,38,.3,"sine",.55*v); } else if(w==="SMG"){ sfxNoiseBurst(.09,"lowpass",3400,700,.42*v); sfxTone(210,80,.07,"square",.12*v); } else { sfxNoiseBurst(.15,"lowpass",2700,320,.55*v); sfxTone(160,55,.11,"sine",.3*v); } }catch(e){} } /* TEMBAKAN: Shotgun berat & panjang, SMG pendek & tajam, Pistol di tengah */
function sfxSirenNote(hi){ if(!AC) return; try{ var f0=hi?742:988, f1=hi?988:742; var t=AC.currentTime; var o=AC.createOscillator(), g=AC.createGain(); o.type="triangle"; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+.4); g.gain.setValueAtTime(.085,t); g.gain.linearRampToValueAtTime(.085,t+.34); g.gain.exponentialRampToValueAtTime(.001,t+.42); o.connect(g); g.connect(sfxGain||AC.destination); o.start(t); o.stop(t+.45); }catch(e){} } /* SIRENE: sapuan dua nada 742↔988 Hz (wail), arah bergantian tiap panggilan dari updateWanted */
function sfxCrash(k){ if(!AC) return; var v=Math.max(.3,Math.min(1.2,k||1)); try{ sfxNoiseBurst(.16+.14*v,"lowpass",900,120,.5*v); sfxTone(105,42,.22+.1*v,"sine",.5*v); }catch(e){} } /* BENTURAN: gesekan logam rendah + gedebuk bass, keras mengikuti kecepatan tabrakan */
/* TAHAP 5 — RADIO BERVARIASI: tiap stasiun punya POLA SENDIRI (melodi 16 langkah, -1 = jeda),
   tangga nada, tempo, gelombang & pola bass yang berbeda — bukan lagi satu pola yang sama untuk semua.
   SEJA FM = funk sinkopasi bertempo sedang • NEON WAVE = arpeggio synth cepat naik-turun •
   AZURA RADIO = melodi pantai pelan & jarang. OFF (radioIdx 3) tetap diam. */
var RADIO_PATTERNS=[
 {tempo:200,wave:"triangle",bassWave:"square",vol:.11,bassVol:.10,scale:[196,220,262,294,330,392],mel:[0,-1,2,2,-1,3,-1,2,0,-1,1,2,-1,4,3,2],bass:[0,-1,0,-1,3,-1,0,-1,0,-1,0,-1,4,-1,3,-1]},
 {tempo:150,wave:"sawtooth",bassWave:"sawtooth",vol:.07,bassVol:.06,scale:[220,262,330,392,440,523],mel:[0,1,2,3,4,5,4,3,0,1,2,3,4,5,4,3],bass:[0,-1,-1,-1,0,-1,-1,-1,1,-1,-1,-1,1,-1,-1,-1]},
 {tempo:340,wave:"sine",bassWave:"sine",vol:.12,bassVol:.12,scale:[262,294,330,392,440,523],mel:[2,-1,-1,4,-1,-1,3,-1,2,-1,-1,1,-1,0,-1,-1],bass:[0,-1,-1,-1,1,-1,-1,-1,0,-1,-1,-1,1,-1,-1,-1]}
];
function startMusic(){ if(musicTimer){ clearTimeout(musicTimer); musicTimer=null; } noteStep=0; var tick=function(){ var p=RADIO_PATTERNS[(radioIdx>=0&&radioIdx<3)?radioIdx:0]; musicTimer=setTimeout(tick,p.tempo); /* jadwal langkah berikut memakai tempo stasiun yang SEDANG aktif, jadi ganti stasiun langsung terasa beda iramanya */ if(!AC||paused||radioIdx===3) return; var mi=p.mel[noteStep%p.mel.length]; if(mi>=0) beep(p.scale[mi%p.scale.length],p.tempo/1000*1.5,p.wave,p.vol); var bi=p.bass[noteStep%p.bass.length]; if(bi>=0) beep(p.scale[bi%p.scale.length]/2,p.tempo/1000*1.9,p.bassWave,p.bassVol); noteStep++; }; musicTimer=setTimeout(tick,260); }
/* THREE SETUP */
var container=document.getElementById("game");
var scene=new THREE.Scene(); scene.background=new THREE.Color(0xb2dcf4); scene.fog=new THREE.Fog(0xb2dcf4,200,520); /* SPEC 12:33 — siang biru: kabut tipis biru-putih mulai JAUH (200+) supaya jalan panjang & palem di kejauhan tetap tajam; warna kabut/latar diperbarui per fase oleh updateSkyDome */
var camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,600);
/* ============ BOOT BERTAHAP + DIAGNOSA ============
   Langkah A: background terang + 1 kubus merah (tanpa lampu) — buktikan renderer+kamera.
   Langkah B: lampu Ambient+Hemisphere+Directional + tanah + jalan — buktikan pencahayaan.
   Langkah C: scene utama penuh (gedung, pemain, mobil, NPC).
   Lanjut ke langkah berikut HANYA jika langkah sebelumnya terbukti tergambar
   (3 frame sukses + piksel canvas terbaca BUKAN hitam, dicek pakai readPixels).
   Latar cadangan disembunyikan HANYA setelah Langkah C lolos. */
var renderer=null, glOK=false, glInfo="—", liteMode=false, renderFailed=false, animStarted=false;
var boot={step:"A", a:false, b:false, c:false, frames:0, firstFrameAt:0, startedAt:performance.now(), done:false};
var bootStage="A", stageGood=0, stageStart=performance.now(), watchdogId=null;
var fpsCount=0, fpsTime=performance.now(), dbgFPS=0, dbgLast=0;
function fpsTick(now){ fpsCount++; if(now-fpsTime>=500){ dbgFPS=Math.round(fpsCount*1000/(now-fpsTime)); fpsCount=0; fpsTime=now; } }
function showBootError(msg){ lastError=msg; var p=document.getElementById("bootError"); if(p){ p.style.display="block"; document.getElementById("bootErrorMsg").textContent=msg; } dbgUpdate(true); }
function hideBootError(){ var p=document.getElementById("bootError"); if(p) p.style.display="none"; }
function showRenderError(msg){ lastError=msg; var ge=document.getElementById("glError"); if(ge){ ge.style.display="block"; ge.textContent=msg; } }
function dbgUpdate(force){ var now=performance.now(); if(!force&&now-dbgLast<250) return; dbgLast=now; var el=document.getElementById("dbgBody"); if(!el) return;
 var cv=(typeof renderer!=="undefined"&&renderer)?renderer.domElement:null;
 var objs=0; if(typeof scene!=="undefined"&&scene){ try{ scene.traverse(function(){ objs++; }); }catch(e){} }
 var camPos="—"; if(typeof camera!=="undefined"&&camera) camPos=camera.position.x.toFixed(1)+", "+camera.position.y.toFixed(1)+", "+camera.position.z.toFixed(1);
 var stepMark=function(k,active){ return boot[k]?"✓":(bootStage===active?"…":"—"); };
 el.textContent=
  "WebGL: "+(glOK?"BERHASIL ✓":"GAGAL ✗")+(liteMode?" (Mode Ringan)":"")+"\n"+
  "GPU: "+glInfo+"\n"+
  "Canvas: "+(cv?cv.clientWidth+"×"+cv.clientHeight+"px (buf "+cv.width+"×"+cv.height+")":"—")+"\n"+
  "Objek di scene: "+objs+" | Frame: "+boot.frames+"\n"+
  "Kamera: "+camPos+"\n"+
  "FPS: "+dbgFPS+"\n"+
  "Tes A kubus merah: "+stepMark("a","A")+" | B lampu+tanah: "+stepMark("b","B")+" | C dunia penuh: "+stepMark("c","C")+"\n"+
  "Error terakhir: "+lastError;
 var big=document.getElementById("bigDbgBody"); if(big) big.textContent=el.textContent;
}
function initGL(opts){ try{ renderer=new THREE.WebGLRenderer(opts||{antialias:true,powerPreference:"high-performance"}); renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)); renderer.shadowMap.enabled=false; container.appendChild(renderer.domElement);
  /* SPEC 12:47: anisotropy aspal = MAKSIMUM yang didukung GPU (tadi 4) — butiran tidak menyeret saat jalan dilihat miring. Tekstur aspal dibuat di bawah (script eval) sebelum initGL dipanggil, jadi aman di-set di sini. */
  try{ var maxAniso=renderer.capabilities.getMaxAnisotropy(); [asphaltTex,asphaltTexH].forEach(function(t){ if(t){ t.anisotropy=maxAniso; t.needsUpdate=true; } }); }catch(e3){}
  var gl=renderer.getContext(); try{ var ext=gl.getExtension("WEBGL_debug_renderer_info"); glInfo=ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).slice(0,42):String(gl.getParameter(gl.VERSION)); }catch(e2){ glInfo="WebGL"; }
  renderer.domElement.addEventListener("webglcontextlost",function(e){ e.preventDefault(); renderFailed=true; lastError="webglcontextlost — konteks WebGL hilang."; showBootError("⚠️ Konteks WebGL hilang (GPU/memori penuh). Coba Mode Ringan, atau tutup game sampai benar-benar ketutup lalu buka lagi."); });
  glOK=true; return true; }catch(e){ glOK=false; lastError="WebGL gagal dibuat: "+((e&&e.message)||e); return false; } }
function sizeGL(){ if(!renderer) return false; var w=window.innerWidth, h=window.innerHeight; if(w<10||h<10) return false; renderer.setSize(w,h); camera.aspect=w/h; camera.fov=camera.aspect<1?72:62; /* SPEC 12:47: layar POTRET (aspect<1) — FOV vertikal ditambah 62→72 supaya jalan & horizon tetap masuk bingkai tanpa memundurkan kamera */ camera.updateProjectionMatrix(); return renderer.domElement.width>0&&renderer.domElement.height>0; }
/* --- adegan tes --- */
var testSceneA=null, testCamA=null, testCube=null, testSceneB=null, testCamB=null;
function buildTestScenes(){
 testSceneA=new THREE.Scene(); testSceneA.background=new THREE.Color(0xffe082); /* latar terang */
 testCamA=new THREE.PerspectiveCamera(60,innerWidth/Math.max(1,innerHeight),.1,100); testCamA.position.set(0,1.2,6); testCamA.lookAt(0,0,0);
 testCube=new THREE.Mesh(new THREE.BoxGeometry(2,2,2), new THREE.MeshBasicMaterial({color:0xff2222})); testSceneA.add(testCube);
 testSceneB=new THREE.Scene(); testSceneB.background=new THREE.Color(0xffe082);
 testSceneB.add(new THREE.AmbientLight(0xffffff,.7)); testSceneB.add(new THREE.HemisphereLight(0xcfe8ff,0x3a5f2a,.7));
 var dd=new THREE.DirectionalLight(0xffe0b0,1.1); dd.position.set(6,12,4); testSceneB.add(dd);
 var gnd=new THREE.Mesh(new THREE.PlaneGeometry(40,40), new THREE.MeshLambertMaterial({color:0x4c9440})); gnd.rotation.x=-Math.PI/2; testSceneB.add(gnd);
 var rd=new THREE.Mesh(new THREE.PlaneGeometry(6,40), new THREE.MeshLambertMaterial({color:0x565a63})); rd.rotation.x=-Math.PI/2; rd.position.y=.02; testSceneB.add(rd); /* JALAN TES B SENGAJA ABU TERANG, BUKAN hitam seperti aspal dunia utama (0x0b0b0d): sampel piksel tengah Langkah B jatuh tepat di badan jalan, jadi aspal hitam membuat black>=.6 dan mean rendah sehingga tes disangka gagal padahal render sehat. Warna tes ini hanya untuk diagnosa — jalan utama tetap hitam. */
 var bx=new THREE.Mesh(new THREE.BoxGeometry(3,3,3), new THREE.MeshLambertMaterial({color:0xe8a87c})); bx.position.set(4,1.5,-2); testSceneB.add(bx);
 testCamB=new THREE.PerspectiveCamera(60,innerWidth/Math.max(1,innerHeight),.1,100); testCamB.position.set(0,7,11); testCamB.lookAt(0,0,0);
}
function readCenter(w,h){ if(!renderer) return null; var cv=renderer.domElement; var x=Math.max(0,((cv.width-w)/2)|0), y=Math.max(0,((cv.height-h)/2)|0); var px=new Uint8Array(w*h*4); try{ renderer.getContext().readPixels(x,y,w,h,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,px); }catch(e){ return null; } return px; }
function pxStats(px){ var n=px.length/4, sum=0, black=0, red=0; for(var i=0;i<px.length;i+=4){ var lum=(px[i]+px[i+1]+px[i+2])/3; sum+=lum; if(lum<12) black++; if(px[i]>150&&px[i+1]<110&&px[i+2]<110) red++; } return {mean:sum/n, black:black/n, red:red/n}; }
/* Langkah C: sampel 5 titik (tengah + 4 kuadran) — satu titik tengah saja bisa kebetulan
   jatuh di aspal gelap/bayangan dan salah memvonis canvas berisi gambar sebagai kosong. */
function readMultiStats(){ if(!renderer) return null; var cv=renderer.domElement, gl=renderer.getContext(); var pts=[[.5,.5],[.25,.3],[.75,.3],[.25,.75],[.75,.75]], w=40, h=40, totMean=0, totBlack=0, ok=0;
 for(var i=0;i<pts.length;i++){ var x=Math.max(0,Math.min(cv.width-w, (cv.width*pts[i][0]-w/2)|0)), y=Math.max(0,Math.min(cv.height-h, (cv.height*pts[i][1]-h/2)|0)); var px=new Uint8Array(w*h*4); try{ gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px); }catch(e){ return null; } var st=pxStats(px); totMean+=st.mean; totBlack+=st.black; ok++; }
 if(!ok) return null; return {mean:totMean/ok, black:totBlack/ok}; }
function startWatchdog(){ if(watchdogId) clearInterval(watchdogId); watchdogId=setInterval(function(){ if(boot.done){ clearInterval(watchdogId); watchdogId=null; return; } if(!boot.firstFrameAt&&performance.now()-boot.startedAt>3000){ showBootError("Sudah 3 detik belum ada satu pun frame 3D yang terbukti tergambar. Kemungkinan: WebGL terblokir di browser ini, GPU/memori penuh, atau canvas berukuran 0px. Coba tombol Mode Ringan di bawah."); } },600); }
function startBoot(){ boot.startedAt=performance.now(); boot.firstFrameAt=0; startWatchdog();
 requestAnimationFrame(function(){ /* layout harus siap dulu sebelum setSize, cegah canvas 0px */
  if(!renderer&&!initGL()){ showBootError("⚠️ WebGL gagal dibuat di perangkat/browser ini, jadi dunia 3D tidak bisa ditampilkan sama sekali. Coba Mode Ringan (renderer minimal), atau buka di browser lain."); dbgUpdate(true); return; }
  var tries=0; (function trySize(){ if(sizeGL()){ renderer.setPixelRatio(1); sizeGL(); /* verifikasi boot di pixel-ratio 1: cepat di GPU software/HP lemah; rasio penuh dipulihkan di finishBoot */ if(!testSceneA) buildTestScenes(); bootStage="A"; stageGood=0; stageStart=performance.now(); requestAnimationFrame(bootLoop); } else if(++tries<24){ requestAnimationFrame(trySize); } else { lastError="Canvas tetap 0px setelah layout siap."; showBootError("⚠️ Canvas 3D berukuran 0px — layout halaman belum siap atau diblokir. Coba Mode Ringan atau buka lagi dari kartu terbaru."); } })();
 }); }
function bootLoop(){ if(boot.done||renderFailed) return; var now=performance.now(); fpsTick(now);
 try{
  if(bootStage==="A"){ testCube.rotation.y+=.03; testCube.rotation.x+=.012; renderer.render(testSceneA,testCamA); var st=pxStats(readCenter(48,48)||new Uint8Array(0)); if(st.red>.25) stageGood++; }
  else if(bootStage==="B"){ renderer.render(testSceneB,testCamB); var st2=pxStats(readCenter(64,64)||new Uint8Array(0)); if(st2.mean>25&&st2.black<.6) stageGood++; }
  else { camera.position.set(Math.sin(.6)*62,22,Math.cos(.6)*62); camera.lookAt(0,7,0); renderer.render(scene,camera); var st3=readMultiStats(); if(st3&&st3.mean>8&&st3.black<.95) stageGood++; }
 }catch(e){ renderFailed=true; lastError="Render gagal di Langkah "+bootStage+": "+((e&&e.message)||e); showBootError("⚠️ Render 3D gagal di Langkah "+bootStage+" ("+lastError+"). Coba Mode Ringan."); return; }
 boot.frames++; if(!boot.firstFrameAt) boot.firstFrameAt=now;
 if(stageGood>=3){ /* 3 frame sukses + piksel terbukti bukan hitam */
  if(bootStage==="A"){ boot.a=true; bootStage="B"; stageGood=0; stageStart=now; }
  else if(bootStage==="B"){ boot.b=true; bootStage="C"; stageGood=0; stageStart=now; }
  else { boot.c=true; boot.done=true; finishBoot(); return; }
 }
 /* Timeout per langkah: scene penuh berat di GPU software (bisa 1-2 dtk/frame), jadi
    Langkah C diberi 25 detik — vonis gagal hanya jika frame BENAR-BENAR tidak terbukti. */
 var stageLimit= bootStage==="C"?25000:7000;
 if(now-stageStart>stageLimit){ lastError="Langkah "+bootStage+" tidak terbukti tampil dalam "+(stageLimit/1000)+" detik."; showBootError("⚠️ Langkah "+bootStage+" tidak terbukti tampil — render jalan tapi piksel canvas tidak sesuai harapan (gelap/kosong). Coba Mode Ringan."); return; }
 dbgUpdate(false); requestAnimationFrame(bootLoop);
}
function finishBoot(){ hideBootError(); /* boot terbukti: 3 frame per langkah + piksel canvas terbaca bukan hitam di Langkah A, B, dan C */
 if(renderer&&!liteMode){ renderer.setPixelRatio(qualityLow?1:Math.min(window.devicePixelRatio||1,2)); sizeGL(); } /* pulihkan pixel-ratio untuk gameplay — tetap 1 bila kualitas Hemat tersimpan aktif */
 if(!animStarted){ animStarted=true; last=performance.now(); animate(); } dbgUpdate(true); }
function retryBoot(){ hideBootError(); renderFailed=false; boot.done=false; boot.a=boot.b=boot.c=false; bootStage="A"; stageGood=0; boot.startedAt=performance.now(); boot.firstFrameAt=0; startWatchdog();
 if(!renderer){ if(!initGL(liteMode?{antialias:false,powerPreference:"low-power"}:undefined)){ showBootError("⚠️ WebGL tetap gagal dibuat. Perangkat/browser ini mungkin tidak mendukung WebGL."); return; } }
 if(!sizeGL()){ requestAnimationFrame(function(){ sizeGL(); }); }
 if(renderer){ renderer.setPixelRatio(1); sizeGL(); }
 if(!testSceneA) buildTestScenes(); stageStart=performance.now(); requestAnimationFrame(bootLoop); }
function lightMode(){ liteMode=true; hideBootError();
 if(renderer){ renderer.setPixelRatio(1); renderer.shadowMap.enabled=false; }
 if(typeof sun!=="undefined"&&sun) sun.castShadow=false;
 if(typeof clouds!=="undefined") clouds.forEach(function(c){ c.visible=false; });
 if(typeof trees!=="undefined") trees.forEach(function(t){ t.visible=false; });
 if(!renderer){ if(initGL({antialias:false,powerPreference:"low-power"})){ startBoot(); } else { showBootError("⚠️ Mode Ringan pun gagal membuat WebGL. Perangkat/browser ini tidak mendukung WebGL."); } return; }
 if(!boot.done){ retryBoot(); } else if(!animStarted){ animStarted=true; last=performance.now(); animate(); }
 dbgUpdate(true); }
document.getElementById("btnLite").onclick=lightMode;
document.getElementById("btnLite2").onclick=lightMode;
document.getElementById("btnRetryBoot").onclick=retryBoot;
/* TAHAP 5: panel diagnosa + label versi + tombol Mode Ringan di dalamnya TERSEMBUNYI dari tampilan normal
   (CSS display:none + inline display:none). Satu-satunya jalan membukanya: menu Pause › Diagnosa.
   Tombol ✕ di panel menutupnya total — tidak ada lagi chip DBG yang tertinggal di layar. */
function hideDebugOverlay(){ var p=document.getElementById("dbgPanel"); if(p) p.style.display="none"; var c=document.getElementById("dbgChip"); if(c) c.style.display="none"; var v=document.getElementById("verTag"); if(v) v.style.display="none"; var b=document.getElementById("bigDbg"); if(b) b.style.display="none"; }
function showDebugOverlay(){ var p=document.getElementById("dbgPanel"); if(p) p.style.display="block"; var v=document.getElementById("verTag"); if(v) v.style.display="block"; var c=document.getElementById("dbgChip"); if(c) c.style.display="none"; if(typeof dbgUpdate==="function") dbgUpdate(true); }
document.getElementById("btnDbgHide").onclick=function(){ hideDebugOverlay(); };
/* Overlay diagnosa BESAR: tampil 4 detik pertama saja, di bagian atas layar, sentuhan tembus */
setTimeout(function(){ var bd=document.getElementById("bigDbg"); if(bd) bd.style.display="none"; },4000);
document.getElementById("dbgChip").onclick=function(){ showDebugOverlay(); };
/* drawFrame dipakai loop utama: render + statistik diagnosa. Latar cadangan hanya
   disembunyikan oleh finishBoot() setelah boot terbukti — bukan di sini. */
function drawFrame(){
 if(renderFailed||!renderer) return;
 try{ renderer.render(scene,camera); }
 catch(e){ renderFailed=true; lastError="Render 3D gagal: "+((e&&e.message)||e); showBootError("⚠️ Render 3D gagal di tengah jalan ("+lastError+"). Coba Mode Ringan."); return; }
 boot.frames++; fpsTick(performance.now()); dbgUpdate(false);
}
var sun=new THREE.DirectionalLight(0xffb36b,1.35); sun.castShadow=false; /* bayangan DIMATIKAN dulu (diagnosa+performa); aktif lagi hanya di Settings kualitas Tinggi */ sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-90; sun.shadow.camera.right=90; sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90; scene.add(sun); var amb=new THREE.AmbientLight(0xffd9b0,.55); scene.add(amb);
var hemi=new THREE.HemisphereLight(0xff9e7a,0x2b1a4a,.5); scene.add(hemi);
/* PENCAHAYAAN CERAH SIANG — warna target siang hari (matahari putih hangat, langit biru cerah);
   loop utama me-lerp warna/intensitas lampu dari warna senja ke warna ini mengikuti ketinggian matahari,
   jadi fase sore tetap jingga dan malam tetap gelap neon, tapi SIANG jadi terang seperti referensi. */
var _daySun=new THREE.Color(0xfff3dd), _dayAmb=new THREE.Color(0xd8e9ff), _dayHemiSky=new THREE.Color(0xbfe0ff), _dayHemiGnd=new THREE.Color(0x55763f); /* SPEC 12:33: cahaya siang PUTIH HANGAT (matahari 0xfff3dd) seperti referensi — target asli dikembalikan (instruksi hangat 12:30 dibatalkan); malam & senja tak berubah */
/* textures */
function makeTex(draw,w,h){ var c=document.createElement("canvas"); c.width=w||256; c.height=h||256; draw(c.getContext("2d"),c.width,c.height); var t=new THREE.CanvasTexture(c); t.anisotropy=4; return t; }
function drawAsphalt(g,w,h){ g.fillStyle="#232833"; g.fillRect(0,0,w,h); for(var i=0;i<5200;i++){ var v=Math.random(); g.fillStyle=v<.5?"rgba(255,255,255,"+(Math.random()*.07)+")":"rgba(0,0,0,"+(Math.random()*.14)+")"; g.fillRect(Math.random()*w,Math.random()*h,1,1);} for(var j=0;j<1400;j++){ g.fillStyle="rgba(180,200,230,"+(Math.random()*.05)+")"; g.fillRect(Math.random()*w,Math.random()*h,2,1);} }
var asphaltTex=makeTex(drawAsphalt); asphaltTex.wrapS=asphaltTex.wrapT=THREE.RepeatWrapping; asphaltTex.repeat.set(1,28); /* SPEC 12:47 — ubin PERSEGI dunia nyata: jalan vertikal 12×340 → repeat 1×28 (dulu 8×8: butiran meregang 28× sepanjang jalan sehingga tampak menyeret saat dilihat miring). Butiran lebih halus (1px, 5200 titik). */
var asphaltTexH=makeTex(drawAsphalt); asphaltTexH.wrapS=asphaltTexH.wrapT=THREE.RepeatWrapping; asphaltTexH.repeat.set(28,1); /* jalan horizontal 340×12: repeat dibalik */
var grassTex=makeTex(function(g,w,h){ g.fillStyle="#3f7d3a"; g.fillRect(0,0,w,h); for(var i=0;i<3200;i++){ var cols=["#4c9440","#356b31","#5aa84c","#6b9e3f"]; g.fillStyle=cols[i%4]; g.fillRect(Math.random()*w,Math.random()*h,3,5);} }); grassTex.wrapS=grassTex.wrapT=THREE.RepeatWrapping; grassTex.repeat.set(10,10);
function buildingTexture(type,base,litRatio){
 return makeTex(function(g,w,h){
  g.fillStyle=base; g.fillRect(0,0,w,h);
  // floor lines
  g.fillStyle="rgba(0,0,0,.22)"; for(var y=32;y<h-44;y+=32) g.fillRect(0,y,w,3);
  // windows sharp grid
  for(var yy=10;yy<h-58;yy+=32){ for(var xx=12;xx<w-18;xx+=30){ var lit=Math.random()<litRatio; g.fillStyle= lit? "#ffd166" : (type==="glass"?"#9fd8e8":"#1c2a3a"); g.fillRect(xx,yy,20,20); g.strokeStyle="rgba(0,0,0,.5)"; g.strokeRect(xx+.5,yy+.5,20,20); g.fillStyle="rgba(255,255,255,.35)"; g.fillRect(xx+2,yy+2,7,7); } }
  // ground floor distinct — TANPA tulisan di dinding: nama/label gedung kini tampil di papan iklan
  // atap bertiang (lihat rooftopBillboard), bukan lagi dicat di tembok. Lantai dasar cukup etalase + pintu.
  g.fillStyle="rgba(0,0,0,.38)"; g.fillRect(0,h-46,w,46);
  g.fillStyle="#ffe9a8"; g.fillRect(14,h-38,62,30); g.fillStyle="#2b1a12"; g.fillRect(104,h-40,30,40); g.fillStyle="#bfe6f2"; g.fillRect(150,h-38,88,30); g.fillStyle="rgba(255,255,255,.4)"; g.fillRect(156,h-34,24,10);
 });
}
var NEON=["HOTEL","AZURA","MIRAGE","OASIS","LUNA","PALACE","SENJA","NEON","CLUB 86","STAR","KASINO","BAR"];
var NEONC=["#ff2e88","#00e5ff","#ffd166","#7CFC00","#ff7a18","#c77dff"];
function neonTexture(txt,col){ return makeTex(function(g,w,h){ g.fillStyle="#12081f"; g.fillRect(0,0,w,h); g.strokeStyle=col; g.lineWidth=5; g.strokeRect(6,6,w-12,h-12); g.fillStyle=col; g.font="bold 44px sans-serif"; g.textAlign="center"; g.shadowColor=col; g.shadowBlur=18; g.fillText(txt,w/2,h/2+15); },256,96); }
/* PLAKAT TOKO GELAP (SPEC 12:33) — latar navy/hitam, teks kuning/putih BESAR TEBAL + bingkai
   tipis berwarna; tekstur 512x192, colorSpace SRGB, di-cache per (teks,warna,gaya); material
   fog:false supaya tetap terbaca dari jauh. Halo tipis + LED bingkai (r9PlaqueSign) menguat
   sore/malam — opacity-nya diatur per frame oleh r9Tick. Sebagian plakat tetap CERAH seperti
   dulu (Bengkel, plakat rumah) — variasi yang diminta user. */
var _plaqueTexCache={}, _plaqueMatCache={};
var r9SignHalos=[]; /* material halo plakat gelap — opacity diatur per frame (sore/malam lebih kuat) */
function plaqueTexture(txt,col,dark){
 var key=txt+"|"+col+"|"+(dark?"D":"B"); if(_plaqueTexCache[key]) return _plaqueTexCache[key];
 var t=makeTex(function(g,w,h){
  if(dark){
   g.fillStyle="#0d1526"; g.fillRect(0,0,w,h);
   g.fillStyle="rgba(255,255,255,.06)"; g.fillRect(0,0,w,12);
   g.strokeStyle=col; g.lineWidth=6; g.strokeRect(8,8,w-16,h-16);
   g.strokeStyle="rgba(255,255,255,.28)"; g.lineWidth=2; g.strokeRect(17,17,w-34,h-34);
   var fs=txt.length>10?54:txt.length>7?66:txt.length>5?78:90;
   g.fillStyle=col; g.font="bold "+fs+"px sans-serif"; g.textAlign="center"; g.textBaseline="middle";
   g.shadowColor="rgba(0,0,0,.6)"; g.shadowBlur=4; g.shadowOffsetY=3; g.fillText(txt,w/2,h/2+4);
  } else {
   g.fillStyle="#12081f"; g.fillRect(0,0,w,h); g.strokeStyle=col; g.lineWidth=5; g.strokeRect(6,6,w-12,h-12); g.fillStyle=col; g.font="bold 44px sans-serif"; g.textAlign="center"; g.shadowColor=col; g.shadowBlur=18; g.fillText(txt,w/2,h/2+15);
  }
 },512,192);
 t.colorSpace=THREE.SRGBColorSpace;
 _plaqueTexCache[key]=t; return t;
}
function plaqueMat(txt,col,dark){ var key=txt+"|"+col+"|"+(dark?"D":"B"); if(_plaqueMatCache[key]) return _plaqueMatCache[key]; var m=new THREE.MeshBasicMaterial({map:plaqueTexture(txt,col,dark),fog:false}); _plaqueMatCache[key]=m; return m; }
/* Plakat gelap lengkap: muka + halo tipis di belakangnya (menonjol 0,35 di tiap sisi). */
function r9PlaqueSign(txt,col,w,h){
 var g=new THREE.Group();
 var halo=new THREE.Mesh(new THREE.PlaneGeometry(w+.7,h+.7),new THREE.MeshBasicMaterial({color:new THREE.Color(col),transparent:true,opacity:.12,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
 halo.position.z=-.06; g.add(halo); r9SignHalos.push(halo.material);
 var face=new THREE.Mesh(new THREE.PlaneGeometry(w,h),plaqueMat(txt,col,true)); g.add(face);
 return g;
}
/* PAPAN IKLAN CERAH — pengganti tulisan dinding: latar warna terang penuh (bukan papan gelap neon lama),
   bingkai putih tebal + teks kontras besar, supaya terbaca jelas di siang cerah maupun dari jauh.
   Tekstur & material di-cache per (teks,warna) dan geometri/tiang DIBAGI, jadi ringan di HP. */
var BRIGHT_BG=["#ff2e88","#00a8ff","#ffd60a","#00c853","#ff6d00","#7c4dff","#00d5c4","#ff1744","#2979ff","#aeea00"];
var _brightTexCache={}, _brightMatCache={};
function brightIsLight(bg){ return bg==="#ffd60a"||bg==="#ffd166"||bg==="#aeea00"||bg==="#7CFC00"||bg==="#00d5c4"; }
function brightBoardTexture(txt,bg){
 var key=txt+"|"+bg; if(_brightTexCache[key]) return _brightTexCache[key];
 var fg=brightIsLight(bg)?"#17202b":"#ffffff";
 var t=makeTex(function(g,w,h){
  g.fillStyle=bg; g.fillRect(0,0,w,h);
  g.fillStyle="rgba(255,255,255,.30)"; g.fillRect(0,0,w,16);
  g.fillStyle="rgba(0,0,0,.14)"; g.fillRect(0,h-12,w,12);
  g.strokeStyle="#ffffff"; g.lineWidth=7; g.strokeRect(5,5,w-10,h-10);
  g.strokeStyle="rgba(0,0,0,.25)"; g.lineWidth=2; g.strokeRect(12,12,w-24,h-24);
  var fs= txt.length>10?29 : txt.length>7?35 : txt.length>5?40 : 46;
  g.fillStyle=fg; g.font="bold "+fs+"px sans-serif"; g.textAlign="center"; g.textBaseline="middle";
  g.shadowColor="rgba(0,0,0,.45)"; g.shadowBlur=5; g.shadowOffsetY=2; g.fillText(txt,w/2,h/2+2);
 },256,96);
 _brightTexCache[key]=t; return t;
}
function brightBoardMat(txt,bg){ var key=txt+"|"+bg; if(_brightMatCache[key]) return _brightMatCache[key]; var m=new THREE.MeshBasicMaterial({map:brightBoardTexture(txt,bg)}); _brightMatCache[key]=m; return m; }
var bbPoleGeo=new THREE.CylinderGeometry(.14,.18,3.1,6);
var bbPoleMat=new THREE.MeshLambertMaterial({color:0x37404a});
var bbBoardGeo=new THREE.BoxGeometry(9.2,3.4,.3);
var bbCrossGeo=new THREE.BoxGeometry(7.6,.18,.18);
/* Papan iklan di ATAS gedung, dipasang pakai 2 tiang + palang silang dari atap — bukan lagi plane nempel dinding. */
function rooftopBillboard(x,z,roofY,txt,bg){
 var g=new THREE.Group(); g.position.set(x,roofY,z);
 [-3.1,3.1].forEach(function(px){ var p=new THREE.Mesh(bbPoleGeo,bbPoleMat); p.position.set(px,1.55,0); p.castShadow=true; g.add(p); });
 var cross=new THREE.Mesh(bbCrossGeo,bbPoleMat); cross.position.set(0,2.85,0); g.add(cross);
 var board=new THREE.Mesh(bbBoardGeo,brightBoardMat(txt,bg)); board.position.set(0,4.85,0); board.castShadow=true; g.add(board);
 scene.add(g); return g;
}
/* WORLD */
var WORLD=150, BLOCK=30, ROAD=12; var ROADS=[-72,-36,0,36,72]; /* TAHAP 4: garis tengah semua jalan vertikal & horizontal — dipakai lampu merah, waypoint polisi & roadblock */
var ground=new THREE.Mesh(new THREE.PlaneGeometry(420,420), new THREE.MeshLambertMaterial({map:grassTex})); ground.rotation.x=-Math.PI/2; ground.position.y=-.05; ground.receiveShadow=true; scene.add(ground);
var ocean=new THREE.Mesh(new THREE.PlaneGeometry(900,900), new THREE.MeshPhongMaterial({color:0x1a6f8a,shininess:90,transparent:true,opacity:.92})); ocean.rotation.x=-Math.PI/2; ocean.position.y=-.6; ocean.position.z=190; scene.add(ocean);
var roadMat=new THREE.MeshLambertMaterial({map:asphaltTex});
var roadMatH=new THREE.MeshLambertMaterial({map:asphaltTexH}); /* jalan horizontal: tekstur diputar (repeat 28×1) */
var roadsGroup=new THREE.Group(); scene.add(roadsGroup);
for(var rx=-2;rx<=2;rx++){ var rp=new THREE.Mesh(new THREE.PlaneGeometry(ROAD,340),roadMat); rp.rotation.x=-Math.PI/2; rp.position.set(rx*36,0.01,0); rp.receiveShadow=true; roadsGroup.add(rp); var rp2=new THREE.Mesh(new THREE.PlaneGeometry(340,ROAD),roadMatH); rp2.rotation.x=-Math.PI/2; rp2.position.set(0,0.01,rx*36); rp2.receiveShadow=true; roadsGroup.add(rp2); }
// road markings: dashed center + zebra + stop lines (thin white planes)
var markMat=new THREE.MeshBasicMaterial({color:0xffffff}); var yellowMat=new THREE.MeshBasicMaterial({color:0xffd166});
function addMark(x,z,w,d,mat){ var m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat||markMat); m.rotation.x=-Math.PI/2; m.position.set(x,0.03,z); scene.add(m); }
for(var rz=-160;rz<170;rz+=8){ for(var k=-2;k<=2;k++){ addMark(k*36,rz,0.35,3.4,yellowMat); addMark(rz,k*36,3.4,0.35,yellowMat);} }
/* ZEBRA CROSSING GARIS TIPIS SEJAJAR — sesuai foto referensi zebra cross asli dari user: BANYAK garis
   putih TIPIS yang sejajar, rapat & rata (17 garis per penyeberangan), tiap garis melintang penuh
   selebar bidang penyeberangan dan garis-garisnya bertumpuk sepanjang arah menyeberang. BUKAN 4 garis
   lebar dan BUKAN pita diagonal seperti versi sebelumnya. Tekstur NS menggambar garis-garis vertikal
   (tipis menyusuri sumbu x bidang 12×3,4 — arah menyeberangi jalan vertikal), tekstur EW menggambar
   garis-garis horizontal (tipis menyusuri sumbu z bidang 3,4×12) — simetris untuk keempat sisi simpang.
   SATU bidang tekstur per penyeberangan; geometri & material DIBAGI — tetap ringan. */
function zebraTexture(ew){ return makeTex(function(g,w,h){ g.clearRect(0,0,w,h); g.fillStyle="#f7f4ea"; var n=17, span= ew? h : w, pitch=span/n, bw=Math.max(3,pitch*.52); for(var i=0;i<n;i++){ var p=i*pitch+(pitch-bw)/2; if(ew) g.fillRect(0,p,w,bw); else g.fillRect(p,0,bw,h); } },256,256); }
var zebraMatNS=new THREE.MeshBasicMaterial({map:zebraTexture(false),transparent:true});
var zebraMatEW=new THREE.MeshBasicMaterial({map:zebraTexture(true),transparent:true});
var zebraGeoNS=new THREE.PlaneGeometry(12,3.4), zebraGeoEW=new THREE.PlaneGeometry(3.4,12);
function addZebra(x,z,ew){ var m=new THREE.Mesh(ew?zebraGeoEW:zebraGeoNS, ew?zebraMatEW:zebraMatNS); m.rotation.x=-Math.PI/2; m.position.set(x,0.035,z); scene.add(m); }
for(var ix=-2;ix<=2;ix++) for(var iz=-2;iz<=2;iz++){ var zx=ix*36, zz=iz*36;
 addMark(zx, zz+6.8, 7, .7); } /* garis henti tetap di semua simpang */
/* ZEBRA CROSSING DI SETIAP PERSIMPANGAN — zebra garis TIPIS SEJAJAR rapi di semua simpang (25 simpang x 4 sisi),
   mengisi penuh lebar jalan dari tepi ke tepi. Tiap penyeberangan hanya SATU bidang bertekstur bersama,
   jadi 100 bidang ini tetap ringan di HP menengah. */
for(var jx=-2;jx<=2;jx++) for(var jz=-2;jz<=2;jz++){ var zx2=jx*36, zz2=jz*36;
 addZebra(zx2,zz2-7.7,false); addZebra(zx2,zz2+7.7,false); /* menyeberangi jalan vertikal (utara & selatan simpang) */
 addZebra(zx2-7.7,zz2,true); addZebra(zx2+7.7,zz2,true); }  /* menyeberangi jalan horizontal (barat & timur simpang) */
// sidewalks
/* SPEC 12:33 — trotoar ABU TERANG + garis sambungan (tekstur), kerb lebih jelas: sisi slab
   lebih gelap & slab sedikit lebih tinggi (0,34), pakai material array (atas = tekstur, sisi = kerb). */
var walkTex=makeTex(function(g,w,h){ g.fillStyle="#c9c9c4"; g.fillRect(0,0,w,h); for(var i=0;i<900;i++){ g.fillStyle="rgba(0,0,0,"+(Math.random()*.04)+")"; g.fillRect(Math.random()*w,Math.random()*h,2,2);} g.strokeStyle="rgba(0,0,0,.20)"; g.lineWidth=3; for(var k=0;k<=4;k++){ var p=k*w/4; g.beginPath(); g.moveTo(p,0); g.lineTo(p,h); g.stroke(); g.beginPath(); g.moveTo(0,p); g.lineTo(w,p); g.stroke(); } }); walkTex.wrapS=walkTex.wrapT=THREE.RepeatWrapping;
var walkTopMat=new THREE.MeshLambertMaterial({map:walkTex});
var walkSideMat=new THREE.MeshLambertMaterial({color:0x8f8f8a}); /* kerb: sisi slab lebih gelap & tegas */
for(var bx=-2;bx<=1;bx++) for(var bz=-2;bz<=1;bz++){ var cx=bx*36+18, cz=bz*36+18; var sw=new THREE.Mesh(new THREE.BoxGeometry(23,0.34,23),[walkSideMat,walkSideMat,walkTopMat,walkSideMat,walkSideMat,walkSideMat]); sw.position.set(cx,0.17,cz); sw.receiveShadow=true; scene.add(sw); }
var colliders=[];
var buildingRects=[]; /* footprint ASLI tiap gedung (pusat + setengah lebar/dalam) — dipakai cek pohon & bangku: lingkaran collider membesar-besarkan sudut gedung, rectangle ini yang menentukan pohon benar-benar menembus dinding atau tidak */
var buildingTypes=[
 {k:"apartment",cols:["#e53935","#ef5350","#ff5252","#d32f2f"]},
 {k:"shop",cols:["#ec407a","#f06292","#ff80ab","#e91e63"]},
 {k:"glass",cols:["#1e88e5","#42a5f5","#00a8ff","#1565c0"]},
 {k:"hotel",cols:["#ff4081","#ff6b9d","#448aff","#ff5252"]},
 {k:"warehouse",cols:["#c62828","#ad1457","#1565c0","#283593"]}
]; /* WARNA GEDUNG MERAH–PINK–BIRU: palet Miami cerah yang saling cocok — apartemen merah bata terang, toko pink cerah, gedung kaca biru terang, hotel campuran pink/merah/biru (tiap gedung ambil satu warna dari daftarnya), gudang merah tua/pink tua/biru tua supaya tetap ada variasi gelap-terang tanpa kembali ke cokelat kusam lama */
var rngSeed=7; function rnd(){ rngSeed=(rngSeed*16807)%2147483647; return (rngSeed-1)/2147483646; }
var instRoofProps=[];
/* SETBACK GEDUNG: jalan lebar 12 di garis kelipatan 36 -> tepi aspal di lokal 6 dan 30 dalam sel blok 36.
   clampToBlock menggeser pusat gedung seperlunya (gerak minimum) supaya tepi footprint + tonjolan (kanopi/balkon)
   selalu >= 1,3 unit dari tepi aspal. Versi lama: offset blok +-5,5 dengan ukuran s/d 20 -> tepi gedung bisa di
   lokal 1,5 alias 4,5 unit MASUK ke badan jalan — itulah gedung yang berdiri di tengah jalan di screenshot user. */
function clampToBlock(c,half){ var m=((c%36)+36)%36, base=c-m, lo=7.3+half, hi=28.7-half; if(hi<lo){ lo=hi=18; } return base+Math.min(Math.max(m,lo),hi); }
function createBuilding(x,z){
 var bt=buildingTypes[Math.floor(rnd()*buildingTypes.length)];
 var wdt=13+rnd()*7, dep=Math.min(13+rnd()*7,16.5), hgt= bt.k==="warehouse"? 8+rnd()*4 : bt.k==="hotel"? 26+rnd()*16 : bt.k==="glass"? 22+rnd()*18 : 12+rnd()*20;
 /* jepit ke zona aman blok SEBELUM mesh/collider dibuat: sumbu x margin 0,3; sumbu z margin 2,4 untuk kanopi+balkon di sisi +z */
 x=clampToBlock(x,wdt/2+.3); z=clampToBlock(z,dep/2+2.4);
 var col=bt.cols[Math.floor(rnd()*bt.cols.length)];
 var tex=buildingTexture(bt.k==="glass"?"glass":bt.k, col, .38);
 var mat=new THREE.MeshLambertMaterial({map:tex});
 var b=new THREE.Mesh(new THREE.BoxGeometry(wdt,hgt,dep),mat); b.position.set(x,hgt/2+.28,z); b.castShadow=true; b.receiveShadow=true; scene.add(b);
 colliders.push({x:x,z:z,r:Math.max(wdt,dep)/2+1});
 buildingRects.push({x:x,z:z,hw:wdt/2,hd:dep/2,k:bt.k,h:hgt}); /* k (tipe) & h (tinggi) ikut dicatat: dipakai memilih gedung yang jadi RUMAH BISA DIMASUKI (bukan gudang) */
 // roof details
 var roofY=hgt+.28;
 if(rnd()>.35){ var tank=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,2.6,8),new THREE.MeshLambertMaterial({color:0x8a5a3a})); tank.position.set(x-wdt/4,roofY+1.3,z-dep/4); tank.castShadow=true; scene.add(tank); }
 if(rnd()>.3){ var ac=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.1,2),new THREE.MeshLambertMaterial({color:0xcccccc})); ac.position.set(x+wdt/4,roofY+.55,z+dep/5); scene.add(ac); }
 if(rnd()>.5){ var ant=new THREE.Mesh(new THREE.BoxGeometry(.18,4.5,.18),new THREE.MeshBasicMaterial({color:0x222222})); ant.position.set(x+wdt/3,roofY+2.2,z-dep/3); scene.add(ant); }
 // balconies
 if(bt.k==="apartment"||bt.k==="hotel"){ for(var f=1;f<Math.floor(hgt/6);f++){ var bal=new THREE.Mesh(new THREE.BoxGeometry(4,.3,1.4),new THREE.MeshLambertMaterial({color:0xeeeeee})); bal.position.set(x, f*6+1, z+dep/2+.7); scene.add(bal);} }
 // canopy / awning
 var can=new THREE.Mesh(new THREE.BoxGeometry(6,.25,2.4),new THREE.MeshLambertMaterial({color:0xff2e88})); can.position.set(x,3.1,z+dep/2+1.1); can.rotation.x=.25; scene.add(can);
 // papan iklan ATAP bertiang (pengganti papan neon yang dulu nempel di dinding): sebagian memakai
 // label gedungnya sendiri (HOTEL / TOKO SEJA / AZURA HQ / SEJA — tulisan yang dulu di tembok),
 // sebagian nama neon kota; warnanya cerah dari palet BRIGHT_BG.
 if(rnd()>.38){ var ni=Math.floor(rnd()*NEON.length); var btxt= rnd()<.42 ? (bt.k==="hotel"?"HOTEL ★":bt.k==="shop"?"TOKO SEJA":bt.k==="glass"?"AZURA HQ":"SEJA") : NEON[ni]; var bbg=BRIGHT_BG[Math.floor(rnd()*BRIGHT_BG.length)]; rooftopBillboard(x,z,roofY,btxt,bbg); }
 return b;
}
var bPos=[];
for(var gx=-2;gx<=1;gx++) for(var gz=-2;gz<=1;gz++){ var cx=gx*36+18, cz=gz*36+18; if(cx===-18&&cz===-54) continue; /* blok ini khusus Taman Senja — tanpa gedung */
 var offs=[[-5.5,-5.5],[5.8,5.2]]; /* 2 buildings per block with alley gap */
 for(var oi=0;oi<2;oi++){ if(rnd()<.12) continue; createBuilding(cx+offs[oi][0]+(rnd()*2-1), cz+offs[oi][1]+(rnd()*2-1)); }
}
// park
var park=new THREE.Mesh(new THREE.BoxGeometry(20,.3,20),new THREE.MeshLambertMaterial({color:0x4c9440})); park.position.set(-18,.15,-54); park.receiveShadow=true; scene.add(park); /* pusat taman DIPINDAH dari (0,-54) ke pusat blok (-18,-54): x=0 adalah garis tengah JALAN, jadi slab taman lama menutupi badan jalan */
for(var fi=0;fi<10;fi++){ var fence=new THREE.Mesh(new THREE.BoxGeometry(2,.9,.15),new THREE.MeshLambertMaterial({color:0xffffff})); fence.position.set(-27+fi*2,.6,-64); scene.add(fence); }
// trees ONLY on sidewalks/park — never on roads
function isRoad(x,z){ return Math.abs(((x%36)+36)%36)<7 || Math.abs(((z%36)+36)%36)<7; }
/* PERBAIKAN POHON NYANGKUT DI RUMAH/GEDUNG (permintaan user): dulu pohon & palem hanya menghindari
   JALAN, tidak pernah mengecek GEDUNG — terbukti dari simulasi denah kota: 9 dari 20 titik treeSpots
   jatuh DI DALAM footprint gedung (mis. (54,54), (-18,54), (18,-54)) dan palem boulevard sisi dalam
   cuma ~1,2 unit dari dinding, jadi batang menembus dinding dan pelepah menembus tembok/atap seperti
   di screenshot user. Sekarang tiap pohon dicek ke footprint rectangle gedung ASLI (buildingRects):
   jarak bebas ke dinding harus >= jangkauan daunnya (palem 3,6 — pelepahnya panjang ~3,7; pohon
   rindang 2,6). Titik yang tertutup gedung DIPINDAH ke titik bebas terdekat (pencarian spiral melebar,
   tetap menghindari jalan, toko/garasi, papan iklan & pohon lain); kalau tidak ada tempat bebas sama
   sekali, pohon TIDAK ditanam — tidak ada lagi pohon menembus rumah. */
var TREE_AVOID=[{x:10,z:88,r:7},{x:-11,z:90,r:9},{x:-14,z:86,r:4},{x:20,z:86,r:4},{x:86,z:-14,r:4},{x:-86,z:20,r:4},{x:14,z:-86,r:4},{x:-23,z:96.5,r:6}]; /* kios toko, slab garasi & papan iklan tanah — jangan ditimpa pohon pindahan; ROUND 10: papan GARASI pindah ke (-23,96.5), r 4→6 menutupi lebar panel */
function rectDist(x,z,b){ var dx=Math.max(Math.abs(x-b.x)-b.hw,0), dz=Math.max(Math.abs(z-b.z)-b.hd,0); return Math.hypot(dx,dz); }
function treeFreeAt(x,z,margin){ if(Math.abs(x)>104||Math.abs(z)>104) return false;
 for(var i=0;i<buildingRects.length;i++){ if(rectDist(x,z,buildingRects[i])<margin) return false; }
 for(var r2=0;r2<ROADS.length;r2++){ if(Math.abs(x-ROADS[r2])<7||Math.abs(z-ROADS[r2])<7) return false; } /* pita aspal ASLI (isRoad bermodul keliru di sisi negatif jalan) */
 for(var a=0;a<TREE_AVOID.length;a++){ if(Math.hypot(x-TREE_AVOID[a].x,z-TREE_AVOID[a].z)<TREE_AVOID[a].r) return false; }
 for(var t=0;t<trees.length;t++){ if(Math.hypot(x-trees[t].position.x,z-trees[t].position.z)<3.2) return false; }
 return true; }
function findTreeSpot(x,z,margin){ if(treeFreeAt(x,z,margin)) return {x:x,z:z};
 var radii=[3,5,7,9,12,15,19,24];
 for(var ri=0;ri<radii.length;ri++){ for(var k=0;k<8;k++){ var ang=k*Math.PI/4, nx=x+Math.sin(ang)*radii[ri], nz=z+Math.cos(ang)*radii[ri]; if(treeFreeAt(nx,nz,margin)) return {x:nx,z:nz}; } }
 return null; }
function createTree(x,z,palm,force){
 if(!force&&isRoad(x,z)) return; /* force=true hanya untuk cincin danau: titiknya sudah lolos uji pita jalan asli di pemanggil */
 var spot=findTreeSpot(x,z, palm?3.6:2.6);
 if(!spot) return; /* titik asli tertutup gedung & tidak ada tempat bebas di sekitarnya — jangan tanam menembus rumah */
 var g=new THREE.Group(); g.position.set(spot.x,0,spot.z);
 var trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,palm?4.2:2.2,6),new THREE.MeshLambertMaterial({color:0x7a4a2a})); trunk.position.y=palm?2.1:1.1; trunk.castShadow=true; g.add(trunk);
 if(palm){ for(var l=0;l<6;l++){ var leaf=new THREE.Mesh(new THREE.BoxGeometry(3.6,.12,.7),new THREE.MeshLambertMaterial({color:0x2e9e4f})); leaf.position.y=4.3; leaf.rotation.y=l*Math.PI/3; leaf.rotation.z=.45; leaf.translateX(1.4); g.add(leaf);} }
 else { var fol=new THREE.Mesh(new THREE.BoxGeometry(2.6,2.6,2.6),new THREE.MeshLambertMaterial({color:0x2f7d32})); fol.position.y=3.4; fol.castShadow=true; g.add(fol); var fol2=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.8,1.8),new THREE.MeshLambertMaterial({color:0x43a047})); fol2.position.set(.7,4.6,.4); g.add(fol2); }
 g.userData.sway=Math.random()*Math.PI*2; scene.add(g); trees.push(g);
}
var trees=[];
var treeSpots=[[-27,-45],[-9,-45],[-27,-63],[-9,-63],[-18,-54],[-54,9],[54,-9],[-54,-54],[54,54],[-18,54],[18,-54],[54,18],[-54,18],[18,54],[-90,18],[90,-18],[-18,-90],[18,90],[90,54],[-90,-54]]; /* 5 spot pertama = pohon Taman Senja, ikut pindah ke blok (-18,-54) */
treeSpots.forEach(function(p,i){ createTree(p[0],p[1], i%3===0); });
/* DANAU TEPI KOTA — permintaan user: ujung-ujung jalan & tanah kosong di tepi peta jangan dibiarkan kosong.
   4 danau diletakkan di strip rumput LUAR jalan terluar (jalan di ±72, tepi aspal ±78; batas gerak ±105),
   di sela-sela garis jalan (danau selalu di antara dua garis jalan, tidak menyentuh aspal), jauh dari semua
   titik misi (semua di dalam ±54), toko, garasi (selatan x -18..-4 z 90) dan titik pickup — terverifikasi
   dari daftar koordinatnya. Tiap danau: cakram pasir (tepi) + cakram air datar statis (ringan, tanpa animasi
   per-frame) + collider r=R-1,5 supaya pemain/mobil tidak berjalan di atas air (berdiri di tepian tetap bisa)
   + CINCIN POHON RINDANG rapat mengelilingi tepinya (campuran pohon daun besar & palem, sebagian diskala
   1,3–1,45x). createTree sendiri menolak titik yang jatuh di jalan. */
var LAKES=[{x:18,z:-93,r:10},{x:93,z:-18,r:10},{x:-93,z:18,r:10},{x:-55,z:93,r:8.5}];
var lakeWaterMat=new THREE.MeshPhongMaterial({color:0x1f7fa8,shininess:110,transparent:true,opacity:.93});
var lakeSandMat=new THREE.MeshLambertMaterial({color:0xd9c08a});
LAKES.forEach(function(L){
 var rim=new THREE.Mesh(new THREE.CircleGeometry(L.r+1.5,26),lakeSandMat); rim.rotation.x=-Math.PI/2; rim.position.set(L.x,0.012,L.z); rim.receiveShadow=true; scene.add(rim);
 var wat=new THREE.Mesh(new THREE.CircleGeometry(L.r,26),lakeWaterMat); wat.rotation.x=-Math.PI/2; wat.position.set(L.x,0.03,L.z); scene.add(wat);
 colliders.push({x:L.x,z:L.z,r:L.r-1.5});
 var nT= Math.round(L.r*1.9);
 for(var ti=0;ti<nT;ti++){ var ta=(ti/nT)*Math.PI*2 + (ti%2? .13 : -.06); var tr=L.r+2.2+(ti%3)*.9; var tx=L.x+Math.cos(ta)*tr, tz=L.z+Math.sin(ta)*tr;
  var band=false; for(var bi2=0;bi2<ROADS.length;bi2++){ if(Math.abs(tx-ROADS[bi2])<7||Math.abs(tz-ROADS[bi2])<7){ band=true; break; } } /* pita aspal jalan memanjang sampai ±170 — pohon cincin yang jatuh di pitanya dilewati. isRoad() bermodul TIDAK dipakai di sini: polanya berulang di luar kisi kota dan keliru menandai rumput tepi peta (mis. z=-106) sebagai jalan. Uji pita terhadap garis jalan ASLI (ROADS) ini yang menentukan; tersaring ~10–14 pohon per danau, semuanya di rumput */
  if(Math.abs(tx)>107||Math.abs(tz)>107||band) continue;
  var before=trees.length; createTree(tx,tz, ti%4===3, true);
  if(trees.length>before && ti%2===0) trees[trees.length-1].scale.setScalar(1.3+(ti%3)*.08); /* separuh pohon dibuat lebih besar & rindang */ }
});
/* ============ PALEM BERDERET & JEMBATAN GANTUNG KUNING — permintaan user dari screenshot referensi ============
   Palem berderet di kedua sisi boulevard selatan (jalan z=72, arah dermaga/toko) dan boulevard timur
   (jalan x=72, arah jembatan), di tepi trotoar (offset 8,5 dari garis jalan) — TIDAK di badan jalan,
   TIDAK di simpang, jauh dari danau & kios toko. Geometri & material DIBAGI (cache) dan tiap palem cuma
   4 mesh (batang miring + 3 pelepah), jadi ringan di HP. Palem ikut array trees: ikut bergoyang halus
   dan ikut disembunyikan Mode Ringan / kualitas Hemat. */
var palmTrunkGeo=new THREE.CylinderGeometry(.16,.3,4.6,6); palmTrunkGeo.translate(0,2.3,0);
var palmLeafGeo=new THREE.BoxGeometry(4,.1,.75); palmLeafGeo.translate(1.7,0,0);
var palmTrunkMat=new THREE.MeshLambertMaterial({color:0x8a5a34});
var palmLeafMat=new THREE.MeshLambertMaterial({color:0x2fa84f});
/* PERBAIKAN PALEM NYANGKUT DI GEDUNG: palmSpotOK lama hanya mengecek jalan/danau/kios — TIDAK pernah
   mengecek gedung, padahal baris dalam boulevard (z/x = 63,5) cuma ~1,2 unit dari dinding gedung di
   belakangnya sementara pelepah palem panjangnya ~3,7: pelepah pasti menembus tembok. palmFreeAt kini
   juga menuntut jarak >= 3,6 dari footprint gedung ASLI; palem yang tertutup gedung dipindah ke titik
   bebas terdekat di sepanjang kawasan boulevard (spiral melebar), dan yang benar-benar tidak dapat
   tempat bebas tidak ditanam. Baris luar (80,5) jauh dari gedung dan tidak berubah. */
function palmFreeAt(x,z){ if(Math.abs(x)>104||Math.abs(z)>104) return false;
 for(var i=0;i<ROADS.length;i++){ if(Math.abs(x-ROADS[i])<8.5||Math.abs(z-ROADS[i])<8.5) return false; }
 for(var j=0;j<LAKES.length;j++){ if(Math.hypot(x-LAKES[j].x,z-LAKES[j].z)<LAKES[j].r+3.5) return false; }
 for(var k=0;k<PALM_AVOID.length;k++){ if(Math.hypot(x-PALM_AVOID[k][0],z-PALM_AVOID[k][1])<7) return false; }
 if(Math.abs(x+11)<13.5&&Math.abs(z-90)<6.5) return false; /* slab garasi */
 for(var b=0;b<buildingRects.length;b++){ if(rectDist(x,z,buildingRects[b])<3.6) return false; }
 for(var t=0;t<trees.length;t++){ if(Math.hypot(x-trees[t].position.x,z-trees[t].position.z)<4) return false; }
 return true; }
function findPalmSpot(x,z){ if(palmFreeAt(x,z)) return {x:x,z:z};
 var radii=[4,7,10,14,18,23,28];
 for(var ri=0;ri<radii.length;ri++){ for(var k=0;k<8;k++){ var ang=k*Math.PI/4, nx=x+Math.sin(ang)*radii[ri], nz=z+Math.cos(ang)*radii[ri]; if(palmFreeAt(nx,nz)) return {x:nx,z:nz}; } }
 return null; }
function createPalmRow(x,z){ var spot=findPalmSpot(x,z); if(!spot) return; /* tertutup gedung & tidak ada tempat bebas — jangan tanam menembus rumah */
 var g=new THREE.Group(); g.position.set(spot.x,0,spot.z); g.rotation.y=Math.random()*Math.PI*2;
 var tr=new THREE.Mesh(palmTrunkGeo,palmTrunkMat); tr.rotation.z=(Math.random()-.5)*.14; tr.castShadow=true; g.add(tr);
 for(var l=0;l<3;l++){ var leaf=new THREE.Mesh(palmLeafGeo,palmLeafMat); leaf.position.y=4.55; leaf.rotation.y=l*Math.PI/3; leaf.rotation.z=.5; g.add(leaf); }
 g.userData.sway=Math.random()*Math.PI*2; scene.add(g); trees.push(g); }
var PALM_AVOID=[[10,88],[54,80],[-54,-80],[-11,90]]; /* kios Toko/Bengkel/SPBU + slab garasi — jangan ditimpa palem */
function palmSpotOK(x,z){ for(var i=0;i<ROADS.length;i++){ if(Math.abs(x-ROADS[i])<8.5||Math.abs(z-ROADS[i])<8.5) return false; } /* simpang & badan jalan dikecualikan; offset baris tepat 8,5 dari garis jalannya sendiri tetap lolos */
 for(var j=0;j<LAKES.length;j++){ if(Math.hypot(x-LAKES[j].x,z-LAKES[j].z)<LAKES[j].r+3.5) return false; }
 for(var k=0;k<PALM_AVOID.length;k++){ if(Math.hypot(x-PALM_AVOID[k][0],z-PALM_AVOID[k][1])<7) return false; } return true; }
for(var px2=-96;px2<=96;px2+=13){ if(palmSpotOK(px2,63.5)) createPalmRow(px2,63.5); if(palmSpotOK(px2,80.5)) createPalmRow(px2,80.5); } /* boulevard selatan, dua sisi */
for(var pz2=-58;pz2<=58;pz2+=13){ if(palmSpotOK(63.5,pz2)) createPalmRow(63.5,pz2); if(palmSpotOK(80.5,pz2)) createPalmRow(80.5,pz2); } /* boulevard timur, dua sisi */
/* JEMBATAN GANTUNG KUNING di tepi timur kota — kini TERSAMBUNG PENUH ke jalan tengah (z=0), tidak lagi
   terpisah/melayang seperti di screenshot keluhan user: jalan aspal naik lewat TANJAKAN landai di kedua
   ujung jembatan (tanjakan barat mulai tepat di luar batas gerak pemain, x=105,5) sampai rata dengan
   permukaan dek, marka kuning berlanjut tanpa putus jalan kota -> tanjakan -> dek -> tanjakan -> jalan
   perpanjangan di timur, deknya sendiri kini beraspal sama seperti jalan, dan ada ABUTMEN beton di bawah
   kedua ujung dek sebagai penopang. Jembatan digeser +18 ke timur supaya seluruh tanjakan berada di luar
   batas gerak pemain (collide ±105): murni pemandangan, tanpa collider/logika per-frame baru, material
   dibagi, mesh tetap ringan. */
(function(){ var yel=new THREE.MeshLambertMaterial({color:0xf5b301}); var yelD=new THREE.MeshLambertMaterial({color:0xd99a06});
 var wat=new THREE.Mesh(new THREE.PlaneGeometry(84,64), new THREE.MeshPhongMaterial({color:0x1f7fa8,shininess:110,transparent:true,opacity:.94})); wat.rotation.x=-Math.PI/2; wat.position.set(168,.02,0); scene.add(wat); /* kanal di bawah jembatan */
 var deck=new THREE.Mesh(new THREE.BoxGeometry(84,.7,10), roadMatH); deck.position.set(168,2.1,0); scene.add(deck); /* dek beraspal hitam sama seperti jalan (dulu abu polos) supaya terlihat menyatu dengan jalan */
 [-4.8,4.8].forEach(function(rz){ var rail=new THREE.Mesh(new THREE.BoxGeometry(84,.5,.3), yelD); rail.position.set(168,2.9,rz); scene.add(rail); });
 [140,186].forEach(function(tx){ [-4.2,4.2].forEach(function(tz){ var leg=new THREE.Mesh(new THREE.BoxGeometry(1,17,1), yel); leg.position.set(tx,8.5,tz); scene.add(leg); });
  [6,14.5].forEach(function(cy){ var cross=new THREE.Mesh(new THREE.BoxGeometry(.9,1.1,9.6), yel); cross.position.set(tx,cy,0); scene.add(cross); }); });
 var cpts=[[126,3],[140,16.5],[163,5.2],[186,16.5],[210,3]];
 function cableY(x){ for(var i=0;i<cpts.length-1;i++){ if(x<=cpts[i+1][0]){ var t=(x-cpts[i][0])/(cpts[i+1][0]-cpts[i][0]); return cpts[i][1]+(cpts[i+1][1]-cpts[i][1])*t; } } return 3; }
 [-5,5].forEach(function(cz){ for(var i=0;i<cpts.length-1;i++){ var x1=cpts[i][0],y1=cpts[i][1],x2=cpts[i+1][0],y2=cpts[i+1][1], len=Math.hypot(x2-x1,y2-y1);
   var seg=new THREE.Mesh(new THREE.BoxGeometry(len,.22,.22), yel); seg.position.set((x1+x2)/2,(y1+y2)/2,cz); seg.rotation.z=Math.atan2(y2-y1,x2-x1); scene.add(seg); }
  [130,135,146,152,158,163,168,174,180,191,196,204].forEach(function(hx){ var hy=cableY(hx), hh=hy-2.45; if(hh<.6) return; var hg=new THREE.Mesh(new THREE.BoxGeometry(.14,hh,.14), yelD); hg.position.set(hx,2.45+hh/2,cz); scene.add(hg); }); });
 /* SAMBUNGAN JALAN <-> JEMBATAN: abutmen beton, tanjakan aspal bermarka, marka di dek, perpanjangan jalan */
 var concMat=new THREE.MeshLambertMaterial({color:0x8d9299});
 [124.6,211.4].forEach(function(ax){ var abm=new THREE.Mesh(new THREE.BoxGeometry(3.4,2.6,11), concMat); abm.position.set(ax,.75,0); scene.add(abm); }); /* abutmen penopang ujung dek */
 var rampLen=Math.hypot(20.5,2.43), rampAng=Math.atan2(2.43,20.5);
 function ramp(cx,dir){ var g=new THREE.Group(); g.position.set(cx,1.245,0); g.rotation.z=dir*rampAng;
  var slab=new THREE.Mesh(new THREE.BoxGeometry(rampLen,.6,10), roadMatH); slab.position.y=-.31; g.add(slab); /* permukaan slab: y=0,02 di kaki bawah, y=2,45 (= permukaan dek) di ujung atas */
  [-4.8,4.8].forEach(function(rz){ var curb=new THREE.Mesh(new THREE.BoxGeometry(rampLen,.45,.3), yelD); curb.position.set(0,.22,rz); g.add(curb); }); /* pembatas kuning mengikuti kemiringan, menyambung pagar dek */
  [-6.8,0,6.8].forEach(function(dx){ var dash=new THREE.Mesh(new THREE.BoxGeometry(3.4,.05,.35), yellowMat); dash.position.set(dx,.03,0); g.add(dash); }); /* marka kuning menaiki tanjakan */
  scene.add(g); }
 ramp(115.75,1); ramp(220.25,-1); /* tanjakan barat x 105,5->126 naik ke dek; tanjakan timur x 210->230,5 turun dari dek */
 for(var bx2=133;bx2<=203;bx2+=8){ var bd=new THREE.Mesh(new THREE.PlaneGeometry(3.4,.35), yellowMat); bd.rotation.x=-Math.PI/2; bd.position.set(bx2,2.47,0); scene.add(bd); } /* marka kuning berlanjut di atas dek */
 var extRoad=new THREE.Mesh(new THREE.PlaneGeometry(66,12), roadMatH); extRoad.rotation.x=-Math.PI/2; extRoad.position.set(198,.012,0); scene.add(extRoad); /* aspal perpanjangan dari ujung jalan kota (x=170) ke kaki tanjakan timur (x=231), di bawah dek tertutup kanal */
 var extGrass=new THREE.Mesh(new THREE.PlaneGeometry(30,64), new THREE.MeshLambertMaterial({map:grassTex})); extGrass.rotation.x=-Math.PI/2; extGrass.position.set(224,-.04,0); scene.add(extGrass); /* alas rumput di bawah kaki tanjakan timur — bidang tanah utama berhenti di x=210 */
})();
// street props: lamps, benches, hydrant, trash, traffic lights, billboards
function lamp(x,z){ var g=new THREE.Group(); g.position.set(x,0,z); var pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,5.4,6),new THREE.MeshLambertMaterial({color:0x333333})); pole.position.y=2.7; g.add(pole); var bulb=new THREE.Mesh(new THREE.SphereGeometry(.32,8,8),new THREE.MeshBasicMaterial({color:0xffe9a8})); bulb.position.y=5.5; g.add(bulb); scene.add(g); }
for(var li=-72;li<=72;li+=36){ lamp(li+7,-7); lamp(li-7,7); lamp(7,li+7); lamp(-7,li-7); }
/* BANGKU / TEMPAT DUDUK — kini model lengkap: dudukan + sandaran + kaki panel, geometri & material
   DIBAGI untuk semua bangku (3 mesh ringan per bangku, tanpa objek baru per frame). Tanpa collider,
   sama seperti bangku & lampu lama, supaya jalur pemain/NPC/mobil/polisi tidak berubah sama sekali. */
var benchSeatGeo=new THREE.BoxGeometry(2.3,.16,.72);
var benchBackGeo=new THREE.BoxGeometry(2.3,.62,.12);
var benchBaseGeo=new THREE.BoxGeometry(1.9,.42,.5);
var benchMat=new THREE.MeshLambertMaterial({color:0x8a5a3a});
var benchBaseMat=new THREE.MeshLambertMaterial({color:0x5d6670});
function bench(x,z,ry){ var g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=ry||0;
 var base=new THREE.Mesh(benchBaseGeo,benchBaseMat); base.position.y=.21; g.add(base);
 var seat=new THREE.Mesh(benchSeatGeo,benchMat); seat.position.y=.5; seat.castShadow=true; g.add(seat);
 var back=new THREE.Mesh(benchBackGeo,benchMat); back.position.set(0,.82,-.3); back.rotation.x=-.12; g.add(back);
 scene.add(g); }
bench(-22,-50); bench(-14,-58); bench(-58,4); /* 2 bangku pertama di dalam Taman Senja, ikut pindah blok */
/* TEMPAT DUDUK TAMBAHAN DI AREA-AREA KOSONG (permintaan user): taman, tepi keempat danau, trotoar luar
   boulevard selatan & timur, dan rumput kosong di tepi utara/barat/timur kota. Semua titik diverifikasi
   dari denah kota: di luar footprint gedung (jarak aman ke dinding), di luar pita aspal jalan (termasuk
   perpanjangan jalan ke tepi peta), tidak menimpa pohon/palem, penanda misi, kios toko, maupun garasi. */
bench(-25,-57,.6); bench(-11,-51,-.5); bench(-12,-63,2.6); /* Taman Senja — melengkapi 2 bangku lama */
bench(27,-84,-2.36); bench(7,-82,2.36); /* tepi Danau Utara, menghadap air */
bench(84,-27,.79); bench(86,-7,2.58); /* tepi Danau Timur, menghadap air */
bench(-84,9,-.79); bench(-84,27,-2.36); /* tepi Danau Barat, menghadap air */
bench(-46,84,-.79); bench(-64,84,.79); /* tepi Danau Selatan, menghadap air */
bench(-24.5,81,Math.PI); bench(27.5,81,Math.PI); /* trotoar luar boulevard selatan, menghadap jalan & deretan palem */
bench(81,-24.5,-Math.PI/2); bench(81,26.5,-Math.PI/2); /* trotoar luar boulevard timur, menghadap jalan & deretan palem */
bench(27,-81,0); bench(-24,-81,0); /* rumput kosong tepi utara, menghadap kota */
bench(-90,-27,Math.PI/2); bench(90,27,-Math.PI/2); /* rumput kosong tepi barat & timur, menghadap kota */
function hydrant(x,z){ var h=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.9,8),new THREE.MeshBasicMaterial({color:0xe53935})); h.position.set(x,.45,z); scene.add(h); }
hydrant(8,8); hydrant(-44,-8); hydrant(44,44);
function trafficLight(x,z){ var g=new THREE.Group(); g.position.set(x,0,z); var p=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,4.6,6),new THREE.MeshLambertMaterial({color:0x222222})); p.position.y=2.3; g.add(p); var box=new THREE.Mesh(new THREE.BoxGeometry(.7,1.6,.5),new THREE.MeshLambertMaterial({color:0x111111})); box.position.y=5; g.add(box); var r=new THREE.Mesh(new THREE.SphereGeometry(.16,8,8),new THREE.MeshBasicMaterial({color:0xff2222})); r.position.set(0,5.45,.3); g.add(r); var gr=new THREE.Mesh(new THREE.SphereGeometry(.16,8,8),new THREE.MeshBasicMaterial({color:0x22ff66})); gr.position.set(0,4.6,.3); g.add(gr); scene.add(g); tlights.push({r:r,gr:gr,axis:(tlights.length%2? "h":"v")}); }
var tlights=[];
trafficLight(7,7); trafficLight(-7,-7); trafficLight(43,7); trafficLight(-43,-43);
/* TAHAP 4 — SIKLUS LAMPU LALU LINTAS: siklus 14 detik. Arus utara-selatan hijau 0–6 dtk, kuning 6–7;
   arus timur-barat hijau 7–13 dtk, kuning 13–14. Kuning diperlakukan MERAH oleh mobil (berhenti). */
function tlState(){ var p=(performance.now()/1000)%14; return {ns:p<6, ew:p>=7&&p<13}; }
function updateTrafficLights(){ var st=tlState(); tlights.forEach(function(t){ var green= t.axis==="v"? st.ns : st.ew; t.r.material.color.setHex(green?0x551111:0xff2222); t.gr.material.color.setHex(green?0x22ff66:0x0d3316); }); }
function billboard(x,z,txt,col,ry){ var g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=ry||0; [-3.4,3.4].forEach(function(px){ var pole=new THREE.Mesh(new THREE.CylinderGeometry(.22,.26,7,6),bbPoleMat); pole.position.set(px,3.5,0); pole.castShadow=true; g.add(pole); }); var cross2=new THREE.Mesh(new THREE.BoxGeometry(7.4,.22,.22),bbPoleMat); cross2.position.y=6.7; g.add(cross2); var board=new THREE.Mesh(new THREE.BoxGeometry(11,4.2,.3),brightBoardMat(txt,col)); board.position.y=8.6; board.castShadow=true; g.add(board); scene.add(g); }
billboard(-14,86,"SEJA COLA","#ff2e88",0); billboard(20,86,"HOTEL AZURA","#00e5ff",0); billboard(86,-14,"MIRAGE","#ffd166",-Math.PI/2); billboard(-86,20,"CLUB 86","#7CFC00",Math.PI/2); billboard(14,-86,"OASIS","#ff7a18",Math.PI);
/* TOKO SEJA + GARASI — lokasi fisik toko di selatan titik awal (spawn 0,70): kios beratap menghadap utara
   (ke arah pemain datang) + penanda silinder emas. Garasi = slab parkir di sebelah baratnya; mobil yang
   dibeli muncul di sana. Zona ini bebas collider gedung (tepi collider gedung terdekat z<=65,7). */
var SHOP_POS={x:10,z:88};
(function(){ var g=new THREE.Group(); g.position.set(SHOP_POS.x,0,SHOP_POS.z);
 var counter=new THREE.Mesh(new THREE.BoxGeometry(4.6,1.1,1.6),new THREE.MeshLambertMaterial({color:0x8a5a3a})); counter.position.set(0,.55,-.9); g.add(counter);
 var back=new THREE.Mesh(new THREE.BoxGeometry(4.6,2.6,.4),new THREE.MeshLambertMaterial({color:0xf2d492})); back.position.set(0,1.3,1.1); g.add(back);
 [-2.1,2.1].forEach(function(px){ var post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,3.1,6),new THREE.MeshLambertMaterial({color:0x333333})); post.position.set(px,1.55,-.9); g.add(post); });
 var roof=new THREE.Mesh(new THREE.BoxGeometry(5.4,.22,3.6),new THREE.MeshLambertMaterial({color:0xff2e88})); roof.position.set(0,3.2,-.1); roof.rotation.x=.12; g.add(roof);
 var sign=r9PlaqueSign("TOKO SEJA","#ffd166",5,1.9); /* SPEC 12:33: Toko Seja pakai plakat GELAP teks kuning (dulu neon cerah) */ sign.position.set(0,2.2,-1.35); sign.rotation.y=Math.PI; g.add(sign);
 scene.add(g); })();
var shopMarker=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,14,18,1,true),new THREE.MeshBasicMaterial({color:0xffd166,transparent:true,opacity:.4,side:THREE.DoubleSide})); shopMarker.position.set(SHOP_POS.x,7,SHOP_POS.z); scene.add(shopMarker);
colliders.push({x:SHOP_POS.x,z:SHOP_POS.z,r:2.7});
var garageSlab=new THREE.Mesh(new THREE.BoxGeometry(24,.24,9),new THREE.MeshLambertMaterial({color:0x3a3f46})); garageSlab.position.set(-11,.12,90); garageSlab.receiveShadow=true; scene.add(garageSlab);
billboard(-23,96.5,"GARASI","#ffd166",Math.PI); /* ROUND 10: papan GARASI digeser mundur dari (-11,84.8) ke rumput belakang slab garasi — panel (x -28,5..-17,5) bersih dari semua pita aspal, tiang 2 unit di selatan slab, tidak menimpa mobil garasi; teks/warna/ukuran sama */
/* ============ TAHAP 3 — EKONOMI & SURVIVAL ============
   3 toko fisik (Toko Seja + Bengkel + SPBU, masing-masing penanda berwarna & ikon huruf di peta),
   pickup medkit & uang tunai yang muncul ulang setelah beberapa menit, mobil ber-health & berbensin
   (asap saat rusak parah, MELEDAK di 0), medkit inventaris, dan helikopter hiasan di langit kota.
   Semua titik toko/pickup dipilih dari simulasi collider gedung (bebas overlap) + findSafeNear. */
var SHOPS=[
 {id:"toko",name:"Toko Seja",short:"TOKO",x:10,z:88,mark:"$",col:0xffd166,roof:0xff2e88,signCol:"#ffd166",face:0,intro:"Senjata, mobil & pakaian yang dibeli langsung bisa dipakai. Mobil yang dibeli menunggu di GARASI, selatan titik awal.",secs:["weapons","ammo","medkit","cars","outfits"]},
 {id:"bengkel",name:"Bengkel Seja",short:"BENGKEL",x:54,z:80,mark:"B",col:0xff7a18,roof:0xff7a18,signCol:"#ff7a18",face:0,intro:"Mobil rusak atau bensin habis? Perbaiki bodi & mesin mobilmu di sini sampai seperti baru. Medkit juga tersedia.",secs:["repair","fuel","medkit"]},
 {id:"spbu",name:"SPBU Seja",short:"SPBU",x:-54,z:-80,mark:"+",col:0x7CFC00,roof:0x2e9e4f,signCol:"#7CFC00",plaque:"dark",face:Math.PI,intro:"Pom bensin Kota Seja: isi tangki sampai penuh sebelum kehabisan di tengah jalan. Ada medkit & amunisi juga.",secs:["fuel","medkit","ammo"]}
];
var curShop="toko", nearShop=null;
function shopById(id){ for(var i=0;i<SHOPS.length;i++) if(SHOPS[i].id===id) return SHOPS[i]; return SHOPS[0]; }
function nearestShop(){ var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z, best=null,bd=6.5; SHOPS.forEach(function(s){ var d=Math.hypot(px-s.x,pz-s.z); if(d<bd){ bd=d; best=s; } }); return best; }
function makeKiosk(s){ var g=new THREE.Group(); g.position.set(s.x,0,s.z); g.rotation.y=s.face||0;
 var counter=new THREE.Mesh(new THREE.BoxGeometry(4.6,1.1,1.6),new THREE.MeshLambertMaterial({color:0x8a5a3a})); counter.position.set(0,.55,-.9); g.add(counter);
 var back=new THREE.Mesh(new THREE.BoxGeometry(4.6,2.6,.4),new THREE.MeshLambertMaterial({color:0xf2d492})); back.position.set(0,1.3,1.1); g.add(back);
 [-2.1,2.1].forEach(function(px){ var post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,3.1,6),new THREE.MeshLambertMaterial({color:0x333333})); post.position.set(px,1.55,-.9); g.add(post); });
 var roof=new THREE.Mesh(new THREE.BoxGeometry(5.4,.22,3.6),new THREE.MeshLambertMaterial({color:s.roof})); roof.position.set(0,3.2,-.1); roof.rotation.x=.12; g.add(roof);
 var sign=(s.plaque==="dark")? r9PlaqueSign(s.name.toUpperCase(),s.signCol,5,1.9) : new THREE.Mesh(new THREE.PlaneGeometry(5,1.9),new THREE.MeshBasicMaterial({map:neonTexture(s.name.toUpperCase(),s.signCol)})); /* SPEC 12:33: plakat GELAP untuk toko bertanda plaque:"dark" (SPBU), CERAH seperti dulu untuk Bengkel */ sign.position.set(0,2.2,-1.35); sign.rotation.y=Math.PI; g.add(sign);
 if(s.id==="spbu"){ [-1.7,1.7].forEach(function(px){ var pump=new THREE.Mesh(new THREE.BoxGeometry(.62,1.25,.55),new THREE.MeshLambertMaterial({color:0xe53935})); pump.position.set(px,.62,-2.4); g.add(pump); var ptop=new THREE.Mesh(new THREE.BoxGeometry(.62,.3,.55),new THREE.MeshBasicMaterial({color:0xffffff})); ptop.position.set(px,1.4,-2.4); g.add(ptop); }); }
 scene.add(g);
 var mk=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,14,18,1,true),new THREE.MeshBasicMaterial({color:s.col,transparent:true,opacity:.4,side:THREE.DoubleSide})); mk.position.set(s.x,7,s.z); scene.add(mk); s.marker=mk;
 colliders.push({x:s.x,z:s.z,r:2.7}); }
SHOPS.forEach(function(s){ if(s.id==="toko"){ s.marker=shopMarker; } else makeKiosk(s); });
/* MEDKIT inventaris (dibeli di toko / disimpan dari pickup saat HP penuh) — dipakai via tombol 💊 atau tombol H: +50 HP */
var medkits=0;
function useMedkit(){ if(!gameStarted||paused) return; initAudio(); if(medkits<=0){ toast("💊 Medkit kosong! Beli di TOKO SEJA, BENGKEL, atau SPBU."); if(AC) beep(220,.08,"square",.12); return; } if(health>=100){ toast("❤️ HP sudah penuh — medkit disimpan dulu."); return; } medkits--; health=Math.min(100,health+50); if(AC) beep(880,.12,"sine",.15); if(navigator.vibrate) navigator.vibrate(40); toast("💊 Medkit dipakai! ❤️ +50 → "+Math.round(health)+"%"); updateHUD(); persistSave(); }
/* mobil yang jadi target layanan bengkel/SPBU: mobil yang sedang dikendarai, atau mobil terdekat (maks 26) */
function serviceCar(){ if(inCar) return inCar; var best=null,bd=26; cars.forEach(function(c){ var d=Math.hypot(c.position.x-player.position.x,c.position.z-player.position.z); if(d<bd){ bd=d; best=c; } }); return best; }
/* PICKUP MEDKIT & UANG — tersebar di kota, melayang berputar, muncul ulang: uang 2 menit, medkit 3 menit */
var pickups=[];
function makeMedkitMesh(){ var g=new THREE.Group(); var base=new THREE.Mesh(new THREE.BoxGeometry(.62,.34,.62),new THREE.MeshLambertMaterial({color:0xf5f5f5})); base.position.y=.17; g.add(base); var c1=new THREE.Mesh(new THREE.BoxGeometry(.46,.12,.16),new THREE.MeshBasicMaterial({color:0xe53935})); c1.position.y=.4; g.add(c1); var c2=new THREE.Mesh(new THREE.BoxGeometry(.16,.12,.46),new THREE.MeshBasicMaterial({color:0xe53935})); c2.position.y=.4; g.add(c2); return g; }
function makeCashMesh(){ var g=new THREE.Group(); var b1=new THREE.Mesh(new THREE.BoxGeometry(.58,.13,.36),new THREE.MeshLambertMaterial({color:0x2e9e4f})); b1.position.y=.08; g.add(b1); var b2=new THREE.Mesh(new THREE.BoxGeometry(.58,.13,.36),new THREE.MeshLambertMaterial({color:0x43a047})); b2.position.y=.21; b2.rotation.y=.35; g.add(b2); var band=new THREE.Mesh(new THREE.BoxGeometry(.6,.05,.38),new THREE.MeshBasicMaterial({color:0xffd166})); band.position.y=.15; g.add(band); return g; }
function addPickup(kind,x,z,respawnMs){ var sp=findSafeNear(x,z); var mesh= kind==="medkit"? makeMedkitMesh() : makeCashMesh(); mesh.position.set(sp.x,0,sp.z); scene.add(mesh); pickups.push({kind:kind,mesh:mesh,x:sp.x,z:sp.z,active:true,respawnAt:0,respawnMs:respawnMs,ph:Math.random()*6}); }
[[-30,80],[0,-20],[80,-54],[-72,-90],[36,-72],[-44,88]].forEach(function(p){ addPickup("medkit",p[0],p[1],180000); });
[[30,-30],[-20,-80],[-80,54],[72,90],[-36,36],[90,18],[10,30],[-90,-18]].forEach(function(p){ addPickup("cash",p[0],p[1],120000); });
function collectPickup(p,now){ if(p.kind==="cash"){ var amt=40+Math.floor(Math.random()*51); money+=amt; toast("💵 Kamu menemukan uang tunai +$"+amt+"!"); if(AC) beep(990,.12,"sine",.16); }
 else { if(health<100){ health=Math.min(100,health+35); toast("✚ Medkit lapangan! ❤️ +35 → "+Math.round(health)+"%"); } else if(medkits<5){ medkits++; toast("💊 HP penuh — medkit disimpan di tas ("+medkits+"/5)"); } else toast("✚ Medkit lapangan! ❤️ sudah penuh"); if(AC) beep(760,.12,"sine",.16); if(navigator.vibrate) navigator.vibrate(40); }
 p.active=false; p.mesh.visible=false; p.respawnAt=now+p.respawnMs; updateHUD(); persistSave(); }
function updatePickups(dt,now){ var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z;
 SHOPS.forEach(function(s){ if(s.marker) s.marker.rotation.y+=dt*.7; });
 pickups.forEach(function(p){ if(!p.active){ if(now>=p.respawnAt){ p.active=true; p.mesh.visible=true; } return; }
  p.mesh.rotation.y+=dt*1.5; p.mesh.position.y=.15+Math.sin(now*.003+p.ph)*.13;
  if(Math.hypot(px-p.x,pz-p.z)<2.4) collectPickup(p,now); }); }
/* ASAP & LEDAKAN MOBIL — pool 14 sprite asap (ringan, tanpa objek baru per frame) + 1 sprite ledakan.
   Mobil ber-health <45 berasap (makin parah makin pekat); health 0 = MELEDAK: bodi gosong, mobil mati,
   pemain yang di dalam terlempar keluar dengan damage 25; ledakan juga melukai pemain di dekatnya. */
var smokeTex=makeTex(function(g,w,h){ var gr=g.createRadialGradient(64,64,6,64,64,62); gr.addColorStop(0,"rgba(210,210,210,.85)"); gr.addColorStop(1,"rgba(120,120,120,0)"); g.fillStyle=gr; g.fillRect(0,0,w,h); },128,128);
var smokePool=[];
for(var smi=0;smi<14;smi++){ var sms=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,transparent:true,opacity:0,depthWrite:false})); sms.visible=false; scene.add(sms); smokePool.push({s:sms,life:0,max:1,vy:0}); }
function emitSmoke(x,y,z,dark){ for(var i=0;i<smokePool.length;i++){ var p=smokePool[i]; if(p.life>0) continue; p.life=p.max=1.3+Math.random()*.8; p.vy=1.4+Math.random()*.8; p.s.position.set(x+(Math.random()-.5)*.5,y,z+(Math.random()-.5)*.5); p.s.material.color.setHex(dark?0x2b2b2b:0xbdbdbd); p.s.visible=true; return; } }
var boomSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:sunTex,transparent:true,depthWrite:false})); boomSprite.visible=false; scene.add(boomSprite);
var boomUntil=0;
function damageCar(c,dmg){ if(!c||c.userData.burnt||dmg<=0) return; c.userData.hp-=dmg; if(c.userData.hp<=0) explodeCar(c); }
function explodeCar(c){ if(c.userData.burnt) return; c.userData.hp=0; c.userData.burnt=true; c.userData.burnT=14; if(c.userData.bodyMat) c.userData.bodyMat.color.setHex(0x17181c); c.userData.eff=0; c.userData.spd=0;
 boomSprite.position.set(c.position.x,1.3,c.position.z); boomSprite.visible=true; boomUntil=performance.now()+450;
 sfxExplosion(); if(navigator.vibrate) navigator.vibrate(200);
 if(c===inCar){ inCar=null; carSpeed=0; headlight.intensity=0; player.visible=true; var a=c.userData.angle, sx=Math.cos(a), sz=-Math.sin(a); var ex=c.position.x+sx*3.2, ez=c.position.z+sz*3.2; if(collide(ex,ez)){ ex=c.position.x-sx*3.2; ez=c.position.z-sz*3.2; } if(collide(ex,ez)){ ex=c.position.x+Math.sin(a)*4; ez=c.position.z+Math.cos(a)*4; } player.position.set(ex,0,ez); health-=25; toast("💥 MOBILMU MELEDAK! Kamu terlempar keluar ❤️ -25%"); updateAB();
  if(health<=0) onPlayerDown("Mobilmu meledak dan kamu terluka parah. Misi diulang dari checkpoint — perbaiki mobil di BENGKEL sebelum health mobil habis."); }
 else { centerMsg("💥 MOBIL MELEDAK!"); var pd=Math.hypot(player.position.x-c.position.x,player.position.z-c.position.z); if(!inCar&&pd<6){ health-=15; knock.x+=(player.position.x-c.position.x)/(pd||1)*9; knock.z+=(player.position.z-c.position.z)/(pd||1)*9; toast("💥 Ledakan mobil melukaimu! ❤️ -15%"); if(health<=0) onPlayerDown("Kamu terkena ledakan mobil. Misi diulang dari checkpoint."); } }
 updateHUD(); }
function updateCarFx(dt,now){ cars.forEach(function(c){ var u=c.userData; if(u.burnt){ if(u.burnT>0){ u.burnT-=dt; u.smokeT-=dt; if(u.smokeT<=0){ u.smokeT=.22; emitSmoke(c.position.x,1.3,c.position.z,true); } } return; }
  if(u.hp<45){ u.smokeT-=dt; if(u.smokeT<=0){ u.smokeT= u.hp<20? .1 : .27; emitSmoke(c.position.x,1.25,c.position.z,false); } } });
 smokePool.forEach(function(p){ if(p.life<=0) return; p.life-=dt; if(p.life<=0){ p.s.visible=false; p.s.material.opacity=0; return; } var t=1-p.life/p.max; p.s.position.y+=p.vy*dt; var sc=1+t*2.4; p.s.scale.set(sc,sc,1); p.s.material.opacity=.45*(p.life/p.max); });
 if(boomSprite.visible){ if(now>=boomUntil) boomSprite.visible=false; else { var bt=1-(boomUntil-now)/450, bs=2+bt*7.5; boomSprite.scale.set(bs,bs,1); boomSprite.material.opacity=1-bt; } } }
/* HELIKOPTER HIASAN — 2 helikopter low-poly berputar pelan mengelilingi kota, baling-baling berputar,
   lampu sorot (kerucut cahaya) menyala di malam hari. Murni suasana: tidak menyerang, tidak bertabrakan. */
function makeHeli(col){ var g=new THREE.Group(); var bm=new THREE.MeshLambertMaterial({color:col});
 var body=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.5,3.6),bm); g.add(body);
 var cab=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.1,1.3),new THREE.MeshLambertMaterial({color:0x223344})); cab.position.set(0,.1,2); g.add(cab);
 var tail=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,3.6),bm); tail.position.set(0,.25,-3.4); g.add(tail);
 var fin=new THREE.Mesh(new THREE.BoxGeometry(.16,1.1,.9),bm); fin.position.set(0,.6,-5.1); g.add(fin);
 var mast=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.5,6),new THREE.MeshLambertMaterial({color:0x222222})); mast.position.y=1; g.add(mast);
 var rotor=new THREE.Group(); rotor.position.y=1.3; var r1=new THREE.Mesh(new THREE.BoxGeometry(7.6,.06,.55),new THREE.MeshBasicMaterial({color:0x222222})); rotor.add(r1); var r2=new THREE.Mesh(new THREE.BoxGeometry(.55,.06,7.6),new THREE.MeshBasicMaterial({color:0x222222})); rotor.add(r2); g.add(rotor);
 var tr=new THREE.Mesh(new THREE.BoxGeometry(.3,1.3,.08),new THREE.MeshBasicMaterial({color:0x222222})); tr.position.set(.32,.6,-5.1); g.add(tr);
 [-0.8,0.8].forEach(function(sx){ var sk=new THREE.Mesh(new THREE.BoxGeometry(.14,.12,2.8),new THREE.MeshLambertMaterial({color:0x333333})); sk.position.set(sx,-1,0); g.add(sk); });
 var cone=new THREE.Mesh(new THREE.ConeGeometry(7.5,36,14,1,true),new THREE.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false})); g.add(cone);
 var bl=new THREE.Mesh(new THREE.SphereGeometry(.26,6,6),new THREE.MeshBasicMaterial({color:0xff4444})); bl.position.set(0,.35,-5.2); g.add(bl); /* lampu suar merah berkedip di ekor — helikopter gampang terlihat dari bawah */
 scene.add(g); return {g:g,rotor:rotor,tr:tr,cone:cone,bl:bl}; }
var helis=[]; [makeHeli(0xec407a),makeHeli(0x00acc1)].forEach(function(h,i){ h.r= i? 64:46; h.h= i? 31:24; h.spd= i? -.075 : .095; /* DITURUNKAN & diperkecil radiusnya (dulu tinggi 37/46, radius 76/104 — terlalu tinggi & jauh untuk terlihat). Kini melintas rendah di atas jalan-jalan kota, masuk pandangan tanpa sudut ekstrem */ h.a= i? 2.4 : .4; h.ph=i*2.1; h.cone.scale.y=h.h/36; h.cone.position.y=-h.h/2-1; helis.push(h); });
function updateHelis(dt,now){ var elevH=Math.sin(((clockT-6)/12)*Math.PI); helis.forEach(function(h){ h.a+=h.spd*dt; h.g.position.set(Math.cos(h.a)*h.r, h.h+Math.sin(now*.0006+h.ph)*1.6, Math.sin(h.a)*h.r); var sgn=h.spd>0?1:-1; h.g.rotation.y=Math.atan2(-Math.sin(h.a)*sgn, Math.cos(h.a)*sgn); h.g.rotation.z=sgn*.1; h.rotor.rotation.y+=dt*26; h.tr.rotation.x+=dt*30; h.cone.material.opacity= elevH<0.02? .15 : 0; if(h.bl) h.bl.visible=Math.floor(now/450)%2===0; }); }
/* SKY DOME — in-scene sunset gradient sky (part of the 3D scene, not a CSS overlay) */
var skyCanvas=document.createElement("canvas"); skyCanvas.width=32; skyCanvas.height=256;
var skyTex=new THREE.CanvasTexture(skyCanvas);
var skyDome=new THREE.Mesh(new THREE.SphereGeometry(430,18,12), new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,fog:false,depthWrite:false}));
skyDome.renderOrder=-10; scene.add(skyDome);
function rgbStr(c){ return "rgb("+c[0]+","+c[1]+","+c[2]+")"; }
function mixc(a,b,t){ return [Math.round(a[0]+(b[0]-a[0])*t),Math.round(a[1]+(b[1]-a[1])*t),Math.round(a[2]+(b[2]-a[2])*t)]; }
var PAL_NIGHT=[[5,9,20],[10,18,44],[16,30,64],[26,44,82]], PAL_SUNSET=[[43,16,85],[123,45,139],[255,126,95],[254,180,123]], PAL_DAY=[[40,104,205],[104,170,232],[178,220,244],[228,244,252]]; /* SPEC 12:33 (menggantikan instruksi 12:30 yang dibatalkan): siang kembali BIRU dengan awan lembut — horizon pucat biru-putih, bukan oranye. Sistem siklus tidak berubah: paletteAt tetap me-lerp NIGHT→SUNSET→DAY. */
function paletteAt(elev){ var a,b,t; if(elev<=0.05){ a=PAL_NIGHT; b=PAL_SUNSET; t=Math.max(0,Math.min(1,(elev+0.35)/0.4)); } else { a=PAL_SUNSET; b=PAL_DAY; t=Math.max(0,Math.min(1,(elev-0.05)/0.55)); } return a.map(function(c,i){ return mixc(c,b[i],t); }); }
var lastSkyBucket=null;
function updateSkyDome(elev){ var bucket=Math.round(elev*16); if(bucket===lastSkyBucket) return; lastSkyBucket=bucket; var pal=paletteAt(elev); var g=skyCanvas.getContext("2d"); var gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,rgbStr(pal[0])); gr.addColorStop(.45,rgbStr(pal[1])); gr.addColorStop(.75,rgbStr(pal[2])); gr.addColorStop(1,rgbStr(pal[3])); g.fillStyle=gr; g.fillRect(0,0,32,256); skyTex.needsUpdate=true; scene.fog.color.setRGB(pal[2][0]/255,pal[2][1]/255,pal[2][2]/255); scene.background=scene.fog.color;
 if(typeof cloudMats!=="undefined"){ var ct=Math.max(0,Math.min(1,(elev-.05)/.55)); for(var ci2=0;ci2<cloudMats.length;ci2++) cloudMats[ci2].color.setRGB(1,.87+.13*ct,.83+.17*ct); } /* awan: kemerahan saat senja, PUTIH bersih saat siang cerah */ }
// sun sprite + clouds
var sunTex=makeTex(function(g,w,h){ var gr=g.createRadialGradient(128,128,8,128,128,128); gr.addColorStop(0,"rgba(255,240,180,1)"); gr.addColorStop(.35,"rgba(255,170,80,.85)"); gr.addColorStop(1,"rgba(255,110,64,0)"); g.fillStyle=gr; g.fillRect(0,0,w,h); },256,256);
var sunSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:sunTex,transparent:true,depthWrite:false,fog:false})); sunSprite.scale.set(84,84,1); scene.add(sunSprite);
var clouds=[], cloudMats=[];
/* SPEC 12:47 — awan LEMBUT: kotak putih tegas diganti SPRITE radial bergradasi (satu tekstur
   di-cache, satu material dibagi untuk semua sprite); tetap 18 gumpal × 6 sprite, sebaran ±170,
   tetap drifting. Tint siang/senja tetap via cloudMats (updateSkyDome) — materialnya yang di-tint. */
var cloudTex=makeTex(function(g,w,h){ var gr=g.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2); gr.addColorStop(0,"rgba(255,255,255,.95)"); gr.addColorStop(.5,"rgba(255,255,255,.6)"); gr.addColorStop(1,"rgba(255,255,255,0)"); g.fillStyle=gr; g.fillRect(0,0,w,h); },128,128);
var cloudSpriteMat=new THREE.SpriteMaterial({map:cloudTex,transparent:true,opacity:.85,depthWrite:false});
var clouds=[], cloudMats=[cloudSpriteMat];
for(var ci=0;ci<18;ci++){ var cg=new THREE.Group(); for(var cb=0;cb<6;cb++){ var sm=new THREE.Sprite(cloudSpriteMat); sm.scale.set(16+Math.random()*12,7+Math.random()*3,1); sm.position.set(cb*7-17,Math.random()*2,Math.random()*3); cg.add(sm);} cg.position.set(Math.random()*340-170,40+Math.random()*22,Math.random()*340-170); scene.add(cg); clouds.push(cg); }
// mission marker
var marker=new THREE.Mesh(new THREE.CylinderGeometry(3,3,18,20,1,true),new THREE.MeshBasicMaterial({color:0xff2e55,transparent:true,opacity:.45,side:THREE.DoubleSide})); scene.add(marker);
/* CHARACTERS & CARS */
/* ============ KARAKTER v2 — WAJAH, VARIASI & IDENTITAS ============
   Dulu semua orang cuma balok polos: kepala tanpa wajah (depan-belakang tak terbedakan) dan NPC
   hanya beda warna baju. Kini makePerson(shirt,skin,opts) membangun karakter low-poly LENGKAP:
   - Kepala SATU mesh multi-material: sisi depan (+z) memakai TEKSTUR WAJAH dari canvas 64x64
     (mata, alis, mulut — varian norm/smile/stern/scar), sisi belakang & atas memakai warna RAMBUT,
     jadi arah hadap terbaca dari jauh. Ditambah hidung balok kecil yang menonjol ke depan.
   - Badan: kerah + garis ritsleting/kancing di DEPAN; di BELAKANG bisa ransel / emblem / panel
     POLISI. Sepatu menonjol ke depan. Leher kecil, bahu (torso ,84) lebih lebar dari jarak kaki.
   - Lengan dua segmen: lengan baju + lengan bawah/telapak warna kulit (panjang lengan ikut gaya
     atasan: rompi/kaos pendek, kemeja/jaket/setelan panjang). Kaki: celana + betis kulit bila
     celana pendek/rok, sepatu terpisah.
   - Struktur userData TIDAK berubah: legL/legR/armL/armR adalah grup pivot sendi (mesh utama di
     children[0], persis seperti yang dipakai applyOutfit & poseWalk), body = mesh torso.
   - Performa: geometri & material DIBAGI LEWAT CACHE (tidak ada geometri/material baru per NPC),
     tekstur wajah di-cache per (warna kulit + varian), <= ~19 mesh per karakter, nol objek per frame.
   - Pemain (opts.own) mendapat material KLONING khusus, karena applyOutfit menulis ulang warna
     material torso/lengan/kaki pemain — material cache bersama tidak boleh ikut berubah. */
var _geoC={}, _matC={}, _basC={}, _faceC={};
function boxGeo(w,h,d){ var k=w+"_"+h+"_"+d, g=_geoC[k]; if(!g){ g=new THREE.BoxGeometry(w,h,d); _geoC[k]=g; } return g; }
function lamMat(c){ var m=_matC[c]; if(!m){ m=new THREE.MeshLambertMaterial({color:c}); _matC[c]=m; } return m; }
function basMat(c){ var m=_basC[c]; if(!m){ m=new THREE.MeshBasicMaterial({color:c}); _basC[c]=m; } return m; }
function shadeOf(c,f){ var r=Math.max(0,Math.min(255,Math.round(((c>>16)&255)*f))), gg=Math.max(0,Math.min(255,Math.round(((c>>8)&255)*f))), b=Math.max(0,Math.min(255,Math.round((c&255)*f))); return (r<<16)|(gg<<8)|b; }
function hexCss(c){ return "#"+("000000"+(c>>>0).toString(16)).slice(-6); }
/* Tekstur wajah 64x64 di canvas, di-cache per warna kulit + varian ekspresi (bukan per NPC) */
function faceMat(skin,variant){ var key=skin+"|"+variant, m=_faceC[key]; if(m) return m;
 var tex=makeTex(function(g){ g.fillStyle=hexCss(skin); g.fillRect(0,0,64,64);
  g.fillStyle="rgba(0,0,0,.10)"; g.fillRect(0,56,64,8); /* bayangan rahang halus */
  var dark="#241a12";
  g.fillStyle=dark; /* ALIS: tegas miring untuk stern/scar, lurus untuk lainnya */
  if(variant==="stern"||variant==="scar"){ g.save(); g.translate(20,21); g.rotate(.45); g.fillRect(-9,-2,18,5); g.restore(); g.save(); g.translate(44,21); g.rotate(-.45); g.fillRect(-9,-2,18,5); g.restore(); }
  else { g.fillRect(11,18,17,4); g.fillRect(36,18,17,4); }
  g.fillStyle="#ffffff"; g.fillRect(13,28,13,10); g.fillRect(38,28,13,10); /* putih mata */
  g.fillStyle="#1c1410"; g.fillRect(17,29,6,8); g.fillRect(42,29,6,8); /* pupil */
  g.fillStyle=dark; /* MULUT */
  if(variant==="smile"){ g.fillRect(26,47,12,3); g.fillRect(23,44,3,4); g.fillRect(38,44,3,4); }
  else if(variant==="stern"||variant==="scar"){ g.fillRect(24,50,16,3); }
  else g.fillRect(27,49,10,3);
  if(variant==="scar"){ g.fillStyle="rgba(140,32,32,.9)"; g.save(); g.translate(51,40); g.rotate(.55); g.fillRect(-1,-10,3,20); g.restore(); } /* bekas luka pipi bos */
 },64,64);
 if(THREE.SRGBColorSpace) tex.colorSpace=THREE.SRGBColorSpace; tex.magFilter=THREE.NearestFilter;
 m=new THREE.MeshLambertMaterial({map:tex}); _faceC[key]=m; return m; }
/* Panel "POLISI" untuk punggung seragam — satu tekstur canvas dipakai semua petugas */
var _polisiMat=null;
function polisiMat(){ if(_polisiMat) return _polisiMat; var tex=makeTex(function(g,w,h){ g.fillStyle="#f5f7fa"; g.fillRect(0,0,w,h); g.fillStyle="#12233f"; g.font="bold 40px Arial, sans-serif"; g.textAlign="center"; g.textBaseline="middle"; g.fillText("POLISI",w/2,h/2+2); },256,64); if(THREE.SRGBColorSpace) tex.colorSpace=THREE.SRGBColorSpace; _polisiMat=new THREE.MeshBasicMaterial({map:tex}); return _polisiMat; }
function makePerson(shirt,skin,opts){ opts=opts||{}; var g=new THREE.Group();
 var hairC= opts.hair!=null? opts.hair : 0x1a120a, hairStyle=opts.hairStyle||"short";
 var top=opts.top||"tee", bottom=opts.bottom||"long", pantsC= opts.pants!=null? opts.pants : 0x223366;
 var own=!!opts.own;
 var shirtM= own? lamMat(shirt).clone() : lamMat(shirt); /* pemain: kloning supaya ganti outfit di toko tidak mewarnai NPC */
 var pantsM= own? lamMat(pantsC).clone() : lamMat(pantsC);
 var skinM=lamMat(skin), darkM=lamMat(shadeOf(shirt,.6)), shoeM=lamMat(opts.shoe!=null?opts.shoe:0x2a2320);
 function part(w,h,d,mat,x,y,z,parent){ var m=new THREE.Mesh(boxGeo(w,h,d),mat); m.position.set(x,y,z||0); (parent||g).add(m); return m; }
 /* KAKI — pivot sendi di pinggul (sama seperti dulu): children[0] = celana (dipakai applyOutfit),
    lalu betis kulit (celana pendek/rok) dan sepatu yang ujungnya menonjol ke depan (+z). */
 var shortLegs=(bottom==="shorts"||bottom==="skirt");
 function makeLeg(x){ var piv=new THREE.Group(); piv.position.set(x,.84,0);
  var lm=new THREE.Mesh(boxGeo(.26, shortLegs?.42:.7, .3), pantsM); lm.position.y= shortLegs? -.21 : -.35; lm.castShadow=true; piv.add(lm);
  if(shortLegs) part(.24,.3,.27, skinM, 0,-.57,0, piv);
  part(.28,.14,.48, shoeM, 0,-.77,.09, piv);
  g.add(piv); return piv; }
 var legL=makeLeg(-.17), legR=makeLeg(.17);
 if(bottom==="skirt") part(.64,.36,.52, lamMat(opts.skirt!=null?opts.skirt:shadeOf(pantsC,1.2)), 0,.72,0); /* rok di pinggul */
 /* BADAN — torso; depan: kerah + garis ritsleting/kancing; belakang: ransel/emblem/panel POLISI */
 var body=new THREE.Mesh(boxGeo(.84,1.02,.44), shirtM); body.position.y=1.31; body.castShadow=true; g.add(body);
 if(top==="jacket"||top==="suit"||top==="shirt"){ part(.52,.13,.47, darkM, 0,1.76,0); /* kerah */
  part(.08,.8,.03, top==="shirt"? lamMat(shadeOf(shirt,1.35)) : darkM, 0,1.3,.225); } /* garis depan */
 if(opts.pack!=null) part(.52,.64,.22, lamMat(opts.pack), 0,1.34,-.33); /* ransel kecil di punggung */
 if(opts.emblem!=null) part(.2,.2,.04, basMat(opts.emblem), 0,1.48,-.245); /* emblem punggung (Azura) */
 if(opts.polisi){ var pp=new THREE.Mesh(new THREE.PlaneGeometry(.64,.3), polisiMat()); pp.position.set(0,1.5,-.238); pp.rotation.y=Math.PI; g.add(pp); }
 if(opts.badge) part(.09,.12,.03, basMat(0xffd94d), -.22,1.52,.23); /* lencana dada */
 if(opts.necklace!=null){ part(.3,.05,.03, basMat(opts.necklace), 0,1.68,.23); part(.1,.13,.03, basMat(opts.necklace), 0,1.57,.23); } /* kalung bos */
 if(opts.belt!=null) part(.86,.11,.46, lamMat(opts.belt), 0,.86,0); /* sabuk */
 /* LENGAN — pivot sendi di bahu: children[0] = lengan baju (dipakai applyOutfit), children[1] =
    lengan bawah + telapak warna kulit. Panjang lengan baju mengikuti gaya atasan. */
 var sleeveLen= top==="vest"? .08 : (top==="tee"? .36 : .56);
 function makeArm(x){ var piv=new THREE.Group(); piv.position.set(x,1.74,0);
  var sm=new THREE.Mesh(boxGeo(.2,sleeveLen,.26), top==="vest"? skinM : shirtM); sm.position.y=-sleeveLen/2; sm.castShadow=true; piv.add(sm);
  part(.17,.84-sleeveLen,.22, skinM, 0,-(sleeveLen+(.84-sleeveLen)/2),0, piv);
  g.add(piv); return piv; }
 var armL=makeArm(-.53), armR=makeArm(.53);
 /* LEHER + KEPALA — satu mesh multi-material: depan = tekstur wajah, belakang/atas = rambut */
 part(.2,.16,.2, skinM, 0,1.87,0);
 var hairM= hairStyle==="bald"? skinM : lamMat(hairC);
 var head=new THREE.Mesh(boxGeo(.54,.54,.54), [skinM,skinM,hairM,skinM,faceMat(skin,opts.face||"norm"),hairM]);
 head.position.y=2.14; head.castShadow=true; g.add(head);
 part(.1,.12,.09, skinM, 0,2.1,.3); /* hidung menonjol ke depan */
 /* RAMBUT / TOPI / TUDUNG */
 if(hairStyle==="short") part(.58,.17,.58, lamMat(hairC), 0,2.44,-.01);
 else if(hairStyle==="long"){ part(.58,.17,.58, lamMat(hairC), 0,2.44,-.01); part(.56,.52,.12, lamMat(hairC), 0,2.14,-.29); }
 else if(hairStyle==="pony"){ part(.58,.17,.58, lamMat(hairC), 0,2.44,-.01); part(.18,.36,.16, lamMat(hairC), 0,2.2,-.33); }
 else if(hairStyle==="cap"){ var capM=lamMat(opts.cap!=null?opts.cap:0xd23b2e); part(.58,.16,.58, capM, 0,2.45,0); part(.56,.05,.3, capM, 0,2.36,.4); }
 else if(hairStyle==="hood"){ var hoodM=lamMat(opts.hood!=null?opts.hood:shirt); part(.6,.2,.6, hoodM, 0,2.43,-.03); part(.6,.56,.14, hoodM, 0,2.16,-.28); }
 else if(hairStyle==="policecap"){ var pcM=lamMat(0x16294d); part(.58,.15,.58, pcM, 0,2.45,0); part(.58,.05,.3, pcM, 0,2.37,.4); }
 if(opts.glasses!=null) part(.47,.11,.05, basMat(opts.glasses), 0,2.16,.28); /* kacamata (Rico: biru muda seperti potret menu) */
 g.userData={legL:legL,legR:legR,armL:armL,armR:armR,body:body,walk:Math.random()*6,gait:0,idlePh:Math.random()*6.28,propKind:null,prop:null}; return g; }
/* PROP TANGAN — senjata digenggam tangan kanan (grup kecil menempel di pivot armR, moncong ke +z).
   Dibangun hanya saat senjata berganti (setHandProp menjaga propKind), tidak ada objek baru per frame. */
function setHandProp(g,kind){ var u=g.userData; if(!u||!u.armR||u.propKind===kind) return; u.propKind=kind;
 if(u.prop){ u.armR.remove(u.prop); u.prop=null; }
 if(!kind) return;
 var grp=new THREE.Group(); grp.position.set(0,-.86,.03); var dark=lamMat(0x17181c);
 if(kind==="knife"){ var hd=new THREE.Mesh(boxGeo(.06,.15,.07), lamMat(0x4a3220)); grp.add(hd); var bl=new THREE.Mesh(boxGeo(.035,.08,.3), basMat(0xcfd6dd)); bl.position.set(0,-.03,.17); grp.add(bl); }
 else { var len= kind==="shotgun"? .62 : (kind==="smg"? .5 : .36);
  var bd=new THREE.Mesh(boxGeo(.09,.15,len), dark); bd.position.set(0,-.02,len/2-.03); grp.add(bd);
  var gr2=new THREE.Mesh(boxGeo(.07,.17,.08), dark); gr2.position.set(0,-.12,.0); grp.add(gr2);
  if(kind==="shotgun"){ var pm=new THREE.Mesh(boxGeo(.07,.06,.16), lamMat(0x5a4028)); pm.position.set(0,-.1,.3); grp.add(pm); } }
 u.armR.add(grp); u.prop=grp; }
/* POSE DIAM — lengan sedikit menekuk + napas sangat halus. Dipanggil HANYA saat karakter benar-benar
   diam (pemain gait=0 / informan berdiri); poseWalk & animasi ayun serangan tetap menimpa setelahnya. */
function idlePose(g,now){ var u=g.userData; if(!u.armL||!u.armR) return; var b=Math.sin(now*.0022+(u.idlePh||0));
 u.armL.rotation.x=-.16+b*.04; u.armR.rotation.x=(u.propKind? -.5 : -.13)+b*.03;
 if(u.body) u.body.scale.y=1+b*.014; }
/* PETUGAS POLISI — seragam biru tua, kap polisi, lencana dada, sabuk, panel POLISI di punggung, wajah tegas.
   Siap dipakai untuk polisi jalan kaki; untuk di dalam mobil dipakai makeOfficerBust(). */
function makeOfficer(skin){ return makePerson(0x1d3461, skin||0xd9a066, {hair:0x14100a,hairStyle:"policecap",top:"suit",pants:0x14264a,belt:0x0d0d10,badge:true,polisi:true,face:"stern",shoe:0x101014}); }
/* Patugas di kursi pengemudi mobil polisi: torso + kepala berkap, terlihat lewat kaca depan mobil */
function makeOfficerBust(){ var grp=new THREE.Group(); var skin=0xd9a066, skinM=lamMat(skin);
 var torso=new THREE.Mesh(boxGeo(.66,.55,.4), lamMat(0x1d3461)); torso.position.set(0,1.06,0); grp.add(torso);
 var badge=new THREE.Mesh(boxGeo(.08,.1,.03), basMat(0xffd94d)); badge.position.set(-.18,1.18,.21); grp.add(badge);
 var head=new THREE.Mesh(boxGeo(.46,.46,.46), [skinM,skinM,lamMat(0x16294d),skinM,faceMat(skin,"stern"),lamMat(0x14100a)]); head.position.set(0,1.27,0); grp.add(head);
 var cap=new THREE.Mesh(boxGeo(.5,.08,.5), lamMat(0x16294d)); cap.position.set(0,1.53,0); grp.add(cap);
 var brim=new THREE.Mesh(boxGeo(.5,.04,.26), lamMat(0x16294d)); brim.position.set(0,1.47,.36); grp.add(brim);
 return grp; }
/* PEJALAN KAKI ACAK — kombinasi kulit/rambut/atasan/bawahan/aksesori; kunci kombinasi dicatat supaya
   26 pejalan kaki tidak ada yang sama persis, plus variasi tinggi & lebar badan ±8%. */
var PED_SKINS=[0xf2c79b,0xe8b08a,0xd9a066,0xb97a4e,0x8a5a33];
var PED_HAIRC=[0x1a120a,0x3a2410,0x6e4520,0x9c6b30,0x23252c,0x8a8f98,0xa83c2a];
var PED_TOPC=[0x42a5f5,0x66bb6a,0xffca28,0xef5350,0x26a69a,0xec407a,0x5c6bc0,0x9ccc65,0xffa726,0x78909c,0x8d6e63,0xd4e157,0x4db6ac,0xba68c8];
var PED_PANTS=[0x223366,0x37474f,0x4e342e,0x263238,0x5d4037,0x35586b,0x6d4c41];
var PED_PACKC=[0x37474f,0x6d4c41,0x283593,0x00695c,0x8e2424];
var _pedCombos={};
function makePed(){ var tries=0, combo="", ri=function(n){ return Math.floor(Math.random()*n); }, si,hi,hs,ti,tt,bi,ai;
 do { tries++; si=ri(PED_SKINS.length); hi=ri(PED_HAIRC.length); hs=ri(5); ti=ri(PED_TOPC.length); tt=ri(4); bi=ri(3); ai=ri(4);
  combo=si+"_"+hi+"_"+hs+"_"+ti+"_"+tt+"_"+bi+"_"+ai; } while(_pedCombos[combo]&&tries<24);
 _pedCombos[combo]=1;
 var o={ hair:PED_HAIRC[hi], hairStyle:["short","long","pony","bald","cap"][hs], top:["tee","shirt","jacket","vest"][tt],
  bottom:["long","shorts","skirt"][bi], pants:PED_PANTS[ri(PED_PANTS.length)], face: Math.random()<.3? "smile":"norm" };
 if(o.bottom==="skirt") o.skirt=PED_TOPC[ri(PED_TOPC.length)];
 if(o.hairStyle==="cap") o.cap=PED_TOPC[ri(PED_TOPC.length)];
 if(ai===1) o.pack=PED_PACKC[ri(PED_PACKC.length)];
 else if(ai===2) o.glasses=0x14161c;
 var g=makePerson(PED_TOPC[ti], PED_SKINS[si], o);
 g.scale.set(.94+Math.random()*.12, .92+Math.random()*.16, .94+Math.random()*.12);
 return g; }
/* Pose jalan dari fase userData.walk; amount (0..1) = blend gait supaya tungkai mereda mulus ke netral saat berhenti, tidak membeku miring */
function poseWalk(g,amount){ var u=g.userData; if(!u.legL) return; var s=Math.sin(u.walk); u.legL.rotation.x=s*.58*amount; u.legR.rotation.x=-s*.58*amount; u.armL.rotation.x=-s*.42*amount; u.armR.rotation.x=s*.42*amount; g.position.y=Math.abs(Math.cos(u.walk))*.05*amount; }
var player=makePerson(0xff5e3a,0xe8b08a,{own:true,hair:0x1a120a,hairStyle:"short",top:"jacket",glasses:0x7ee8fa,pack:0x30343c,face:"smile"}); player.position.set(0,0,70); scene.add(player); /* RICO: jaket oranye-merah, kacamata biru muda seperti potret menu, ransel gelap supaya jelas dari belakang (kamera chase) */ /* spawn di tengah persimpangan jalan (0,70): titik lama (-8,64) berada DI DALAM radius collider gedung kaca (-12.2,58.6 r=9.8) sehingga semua gerakan ditolak collide() dan karakter tidak bisa jalan sama sekali */
var playerAngle=Math.PI, playerSpeed=0; /* SPEC 12:51: hadap awal UTARA (-z, menyusuri jalan utama) — dulu 0 (selatan, ke pantai/lapangan kosong) */
/* TAHAP 2 COMBAT FX — kilat moncong (sprite) + garis tracer peluru (pool 5 garis, tanpa objek berat baru per tembakan) */
var flashSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:sunTex,transparent:true,depthWrite:false})); flashSprite.scale.set(1.15,1.15,1); flashSprite.visible=false; scene.add(flashSprite);
var flashUntil=0;
function muzzleFlash(x,y,z){ flashSprite.position.set(x,y,z); flashSprite.visible=true; flashUntil=performance.now()+55; }
var tracers=[];
for(var tri=0;tri<5;tri++){ var trg=new THREE.BufferGeometry(); trg.setAttribute("position",new THREE.BufferAttribute(new Float32Array(6),3)); var trl=new THREE.Line(trg,new THREE.LineBasicMaterial({color:0xffe9a8,transparent:true,opacity:0})); trl.frustumCulled=false; scene.add(trl); tracers.push({line:trl,until:0}); }
function fireTracer(x1,y1,z1,x2,y2,z2,col){ var now=performance.now(), t=null; for(var i=0;i<tracers.length;i++){ if(tracers[i].until<now){ t=tracers[i]; break; } } if(!t) t=tracers[0]; var a=t.line.geometry.attributes.position.array; a[0]=x1; a[1]=y1; a[2]=z1; a[3]=x2; a[4]=y2; a[5]=z2; t.line.geometry.attributes.position.needsUpdate=true; t.line.material.color.setHex(col||0xffe9a8); t.line.material.opacity=.95; t.until=now+95; }
/* TAHAP 1 — CINCIN PENANDA AUTO-AIM: satu mesh cincin dipakai ulang, ditaruh di kaki musuh yang sedang dibidik */
var aimRing=new THREE.Mesh(new THREE.RingGeometry(.55,.85,24),new THREE.MeshBasicMaterial({color:0xff3355,transparent:true,opacity:.95,side:THREE.DoubleSide,depthWrite:false})); aimRing.rotation.x=-Math.PI/2; aimRing.position.y=.07; aimRing.visible=false; scene.add(aimRing);
/* TAHAP 2 — SPRITE PERINGATAN BOS: kilat merah berdenyut di atas bos 0,45 detik sebelum ia menembak (dipakai ulang) */
var warnSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:sunTex,transparent:true,depthWrite:false})); warnSprite.material.color.setHex(0xff2222); warnSprite.scale.set(1.2,1.2,1); warnSprite.visible=false; scene.add(warnSprite);
/* NPC DI TROTOAR — versi lama: pejalan kaki jalan acak dan sering berakhir di tengah jalan.
   Kini mereka berjalan menyusuri JARINGAN TROTOAR: garis pejalan di offset ±8,5 / ±27,5 dari garis blok
   (tepi aspal di ±6, slab trotoar membentang 6,5–29,5), dari simpul ke simpul tetangga. Mereka hanya
   meninggalkan trotoar saat KABUR (flee) dari serangan/tembakan, lalu kembali ke simpul terdekat. */
var SW_OFFS=[]; for(var sk=-3;sk<=2;sk++){ SW_OFFS.push(sk*36+8.5); SW_OFFS.push(sk*36+27.5); }
function nearestSwIdx(v){ var bi=0,bd=1e9; for(var i=0;i<SW_OFFS.length;i++){ var d=Math.abs(SW_OFFS[i]-v); if(d<bd){ bd=d; bi=i; } } return bi; }
function pickPedTarget(p){ var u=p.userData, opts=[]; if(u.nx>0)opts.push([-1,0]); if(u.nx<SW_OFFS.length-1)opts.push([1,0]); if(u.nz>0)opts.push([0,-1]); if(u.nz<SW_OFFS.length-1)opts.push([0,1]); var o=opts[Math.floor(Math.random()*opts.length)]; u.tx=u.nx+o[0]; u.tz=u.nz+o[1]; u.hasTarget=true; }
function respawnPed(p){ var ix=Math.floor(Math.random()*SW_OFFS.length), iz=Math.floor(Math.random()*SW_OFFS.length); p.position.set(SW_OFFS[ix],0,SW_OFFS[iz]); p.rotation.set(0,Math.random()*Math.PI*2,0); var u=p.userData; u.hp=30; u.deadT=0; u.fleeT=0; u.nx=ix; u.nz=iz; u.hasTarget=false; }
var peds=[];
for(var pi=0;pi<26;pi++){ var ped=makePed(); var pix=Math.floor(Math.random()*SW_OFFS.length), piz=Math.floor(Math.random()*SW_OFFS.length); ped.position.set(SW_OFFS[pix],0,SW_OFFS[piz]); ped.userData.dir=Math.random()*Math.PI*2; ped.userData.spd=.8+Math.random()*.6; ped.userData.hp=30; ped.userData.deadT=0; ped.userData.fleeT=0; ped.userData.fleeX=0; ped.userData.fleeZ=0; ped.userData.nx=pix; ped.userData.nz=piz; ped.userData.hasTarget=false; scene.add(ped); peds.push(ped); }
/* MOBIL MODERN — siluet dua tingkat (bodi rendah lebar + bahu + glasshouse kaca gelap + atap panel),
   strip lampu LED penuh di depan & belakang, gril, bemper trim gelap, spion, velg alloy (tutup silinder
   roda memakai material terang), dan spoiler untuk sebagian mobil sipil. Semua geometri & material
   DIBAGI antar mobil (kecuali cat bodi per mobil, yang memang harus sendiri untuk efek hangus) — ringan. */
var carBodyGeo=new THREE.BoxGeometry(2.14,.58,4.4), carShoulderGeo=new THREE.BoxGeometry(1.98,.3,3.1), carGlassGeo=new THREE.BoxGeometry(1.8,.52,2.05), carRoofGeo=new THREE.BoxGeometry(1.86,.09,1.45), carBumperGeo=new THREE.BoxGeometry(2.18,.3,.34), carLedGeo=new THREE.BoxGeometry(1.78,.11,.07), carGrilleGeo=new THREE.BoxGeometry(1.15,.2,.06), carMirrorGeo=new THREE.BoxGeometry(.1,.12,.22), carSpoilerGeo=new THREE.BoxGeometry(1.95,.07,.42), carStrutGeo=new THREE.BoxGeometry(.14,.2,.24), carWheelGeo=new THREE.CylinderGeometry(.4,.4,.3,12);
var carGlassMat=new THREE.MeshLambertMaterial({color:0x141e28}), carGlassMatPol=new THREE.MeshLambertMaterial({color:0x9fc0d4,transparent:true,opacity:.45}), carTrimMat=new THREE.MeshLambertMaterial({color:0x14161a}), carTireMat=new THREE.MeshLambertMaterial({color:0x0c0c0e}), carHubMat=new THREE.MeshLambertMaterial({color:0xc7ccd4}), carLedMat=new THREE.MeshBasicMaterial({color:0xfff6cf}), carTailMat=new THREE.MeshBasicMaterial({color:0xff2a2a}), carRoofWhiteMat=new THREE.MeshLambertMaterial({color:0xf2f4f6});
function makeCar(color,isPolice){ var g=new THREE.Group(); var bodyMat=new THREE.MeshLambertMaterial({color:color}); g.userData.bodyMat=bodyMat; g.userData.origColor=color; g.userData.hp=100; g.userData.fuel=100; g.userData.burnt=false; g.userData.smokeT=0; /* TAHAP 3: tiap mobil punya health & bensin sendiri */
 var body=new THREE.Mesh(carBodyGeo,bodyMat); body.position.y=.58; body.castShadow=true; g.add(body);
 var sh=new THREE.Mesh(carShoulderGeo,bodyMat); sh.position.set(0,.93,-.25); g.add(sh); /* bahu bodi di bawah kaca — kesan sedan modern bertingkat */
 var glass=new THREE.Mesh(carGlassGeo, isPolice?carGlassMatPol:carGlassMat); glass.position.set(0,1.18,-.28); g.add(glass); /* glasshouse: pita kaca gelap menyatu depan–samping–belakang */
 var roof=new THREE.Mesh(carRoofGeo, isPolice?carRoofWhiteMat:bodyMat); roof.position.set(0,1.48,-.3); g.add(roof); /* atap panel tipis; polisi tetap putih */
 var bf=new THREE.Mesh(carBumperGeo,carTrimMat); bf.position.set(0,.34,2.12); g.add(bf);
 var bb=new THREE.Mesh(carBumperGeo,carTrimMat); bb.position.set(0,.34,-2.12); g.add(bb);
 var led=new THREE.Mesh(carLedGeo,carLedMat); led.position.set(0,.66,2.21); g.add(led); /* strip LED depan selebar mobil */
 var tail=new THREE.Mesh(carLedGeo,carTailMat); tail.position.set(0,.72,-2.21); g.add(tail); /* strip lampu belakang merah penuh */
 var gr=new THREE.Mesh(carGrilleGeo,carTrimMat); gr.position.set(0,.44,2.21); g.add(gr);
 [-1,1].forEach(function(s){ var mr=new THREE.Mesh(carMirrorGeo,carTrimMat); mr.position.set(s*1.02,1.12,.62); g.add(mr); }); /* spion */
 if(isPolice){ var bust=makeOfficerBust(); bust.position.set(-.42,0,.02); g.add(bust); /* petugas duduk di kursi pengemudi, kepala+kap terlihat lewat kaca depan */ var bar=new THREE.Mesh(new THREE.BoxGeometry(1.2,.22,.5),new THREE.MeshBasicMaterial({color:0xff2222})); bar.position.set(0,1.63,-.25); g.add(bar); g.userData.bar=bar; }
 else if((color&3)===1){ var st=new THREE.Mesh(carStrutGeo,carTrimMat); st.position.set(0,.95,-2.02); g.add(st); var sp=new THREE.Mesh(carSpoilerGeo,bodyMat); sp.position.set(0,1.08,-2.05); g.add(sp); } /* sebagian mobil sipil bergaya sport */
 g.userData.wheels=[]; [[-.98,1.42],[.98,1.42],[-.98,-1.42],[.98,-1.42]].forEach(function(p){ var w=new THREE.Mesh(carWheelGeo,[carTireMat,carHubMat,carHubMat]); w.rotation.z=Math.PI/2; w.position.set(p[0],.4,p[1]); g.add(w); g.userData.wheels.push(w); }); /* roda: ban gelap + tutup velg alloy terang */
 return g; }
var cars=[], police=[];
var carCols=[0xe53935,0x1e88e5,0xfdd835,0x8e24aa,0xfb8c00,0x00acc1,0xec407a,0x7cb342];
for(var cai=0;cai<14;cai++){ var car=makeCar(carCols[cai%carCols.length],false); var lane=[-72,-36,0,36,72][cai%5]; var horiz=cai%2===0; car.position.set(horiz? Math.random()*140-70: lane, 0, horiz? lane: Math.random()*140-70); car.userData.horiz=horiz; car.userData.dir=(cai%4<2?1:-1); car.userData.spd=7+Math.random()*5; car.userData.angle=horiz?((cai%4<2)?Math.PI/2:-Math.PI/2):((cai%4<2)?0:Math.PI); car.userData.parked=cai>10; /* JANGAN ganti objek userData utuh: makeCar menyimpan wheels di sana — menimpanya membuat updateTraffic melempar TypeError tiap frame SEBELUM render, itulah penyebab layar gelap */ if(car.userData.parked){ /* BUG MOBIL DI DALAM GEDUNG: posisi parkir lama (-14..-2, 58) berada DI DALAM collider gedung blok (-18,54) — terbukti dari simulasi collider (jarak 8,5-8,8 < r 9,3). Kini parkir di TEPI jalan horizontal z=72 (badan jalan 66-78), sejajar jalan, terverifikasi bebas collider: */ car.position.set(-30+(cai-11)*6,0,69); car.userData.angle=Math.PI/2; car.rotation.y=Math.PI/2; } scene.add(car); cars.push(car); }
for(var poi=0;poi<3;poi++){ var pc=makeCar(0x111111,true); pc.position.set(72,0,-48-poi*12); pc.visible=false; scene.add(pc); police.push(pc); } /* spawn polisi DI BADAN JALAN vertikal x=72 — posisi lama (60,-60) berada di dalam collider gedung (53.6,-55.5) r=11 */
var headlight=new THREE.SpotLight(0xffe9a8,0,32,.55,.45,1); scene.add(headlight); scene.add(headlight.target);
/* ============ RUMAH BISA DIMASUKI — Rumah Rico (safehouse) + beberapa rumah warga ============
   Beberapa gedung yang SUDAH ADA dipilih jadi rumah yang bisa dimasuki (yang terdekat ke titik awal,
   bukan gudang, berjauhan satu sama lain): penanda silinder hijau + papan nama di pintunya (pintu =
   sisi +z gedung, sisi kanopi). Interiornya SATU ruangan sederhana bersama (lantai kayu, sofa, TV,
   tempat tidur, dapur kecil, meja makan, lemari, rak buku, lampu lantai, tanaman) yang dibangun di
   koordinat jauh di luar kota & di bawah tanah (0,-40,400) supaya tidak terlihat dari permukaan dan
   tidak menabrak collider kota mana pun (collide() kota hanya 2D x/z dan semua objek kota di ±105).
   Masuk = teleport ke dalam + ingat titik pintu; keluar = teleport kembali ke pintu yang sama.
   Selama di dalam: gerak pemain dijepit tetap di dalam ruangan + didorong keluar dari perabot
   (INT_SOLIDS), kamera jarak dekat & dijepit di dalam ruangan, dan persistSave menyimpan posisi
   PINTU (bukan interior) supaya Continue menaruh pemain di depan rumahnya. Polisi tidak bisa melihat
   pemain di dalam (garis pandang putus), jadi wanted luruh lewat aturan kehilangan jejak yang lama.
   Gameplay, misi, toko & kontrol lain TIDAK diubah. */
var HOUSES=[], inHouse=null, nearHouse=null;
var INT={x:0,y:-40,z:400,hw:7,hd:5};
var INT_SOLIDS=[];
(function(){ function doorClear(b){ var dx=b.x, dz=b.z+b.hd+1.9; for(var i=0;i<buildingRects.length;i++){ var r=buildingRects[i]; if(r!==b&&rectDist(dx,dz,r)<1) return false; } return true; } /* titik pintu TIDAK boleh jatuh di dalam / menempel gedung tetangga (kasus nyata: gedung terdekat ke titik awal pintunya tertutup gedung sebelahnya) */
 var cands=buildingRects.filter(function(b){ return b.k!=="warehouse" && doorClear(b); });
 cands.sort(function(a,b){ var pa=(a.k==="apartment"||a.k==="shop")?0:1, pb=(b.k==="apartment"||b.k==="shop")?0:1; if(pa!==pb) return pa-pb; return Math.hypot(a.x,a.z-70)-Math.hypot(b.x,b.z-70); }); /* apartemen/toko (paling mirip rumah) didahulukan, lalu yang terdekat ke titik awal (0,70) */
 for(var i=0;i<cands.length&&HOUSES.length<3;i++){ var b=cands[i], ok=true;
  for(var j=0;j<HOUSES.length;j++){ if(Math.hypot(b.x-HOUSES[j].bx,b.z-HOUSES[j].bz)<24){ ok=false; break; } } /* rumah terpilih harus berjauhan */
  if(!ok) continue;
  HOUSES.push({bx:b.x,bz:b.z,bhd:b.hd,dx:b.x,dz:b.z+b.hd+1.9,name: HOUSES.length===0? "Rumah Rico" : "Rumah Warga"}); }
 HOUSES.forEach(function(h,idx){ var mk=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,11,14,1,true),new THREE.MeshBasicMaterial({color:0x7CFC00,transparent:true,opacity:.3,side:THREE.DoubleSide})); mk.position.set(h.dx,5.5,h.dz); scene.add(mk);
  var sign=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.7),new THREE.MeshBasicMaterial({map:neonTexture(idx===0?"RUMAH RICO":"RUMAH","#7CFC00")})); sign.position.set(h.bx,3.7,h.bz+h.bhd+.3); scene.add(sign); });
})();
function houseDoorNear(){ if(inCar||inHouse) return null; for(var i=0;i<HOUSES.length;i++){ var h=HOUSES[i]; if(Math.hypot(player.position.x-h.dx,player.position.z-h.dz)<3.4) return h; } return null; }
function atExitDoor(){ return !!inHouse && Math.hypot(player.position.x-INT.x,player.position.z-(INT.z+3.9))<2.8; }
function enterHouse(h){ if(!h||inHouse||inCar||!gameStarted||paused) return; inHouse={rx:h.dx,rz:h.dz,name:h.name}; player.position.set(INT.x,INT.y,INT.z+3.1); player.rotation.y=Math.PI; playerAngle=Math.PI; camYaw=0; camPitch=.45; if(navigator.vibrate) navigator.vibrate(40); toast("🏠 Kamu masuk ke "+h.name+". Dekati pintu (keset hijau) untuk keluar."); persistSave(); }
function exitHouseFn(){ if(!inHouse) return; var rx=inHouse.rx, rz=inHouse.rz; inHouse=null; player.position.set(rx,0,rz); player.rotation.y=0; playerAngle=0; camYaw=Math.PI; if(navigator.vibrate) navigator.vibrate(40); toast("🚪 Kamu keluar rumah."); persistSave(); }
function buildInterior(){ var X=INT.x, Y=INT.y, Z=INT.z;
 function bx(w,h,d,c,x,y,z){ var m=new THREE.Mesh(boxGeo(w,h,d),lamMat(c)); m.position.set(X+x,Y+y,Z+z); scene.add(m); return m; }
 function solid(x,z,r){ INT_SOLIDS.push({x:X+x,z:Z+z,r:r}); }
 bx(14.6,.2,10.6,0x8a5a3a, 0,-.1,0);            /* lantai kayu */
 bx(14.6,.25,10.6,0xe8dcc8, 0,3.72,0);          /* langit-langit */
 bx(14.6,3.8,.3,0xf2d492, 0,1.9,-5.15);         /* dinding utara */
 bx(14.6,3.8,.3,0xf2d492, 0,1.9,5.15);          /* dinding selatan (ada pintu keluar) */
 bx(.3,3.8,10.6,0xead9b0, -7.15,1.9,0);         /* dinding barat */
 bx(.3,3.8,10.6,0xead9b0, 7.15,1.9,0);          /* dinding timur */
 var rug=new THREE.Mesh(new THREE.PlaneGeometry(5,3.4),lamMat(0xc23b4e)); rug.rotation.x=-Math.PI/2; rug.position.set(X-.6,Y+.02,Z+.3); scene.add(rug); /* karpet merah ruang tengah */
 bx(1.3,2.5,.14,0x5a3a22, 0,1.25,4.92);         /* daun pintu keluar di dinding selatan */
 var keset=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.05),lamMat(0x2e7d46)); keset.rotation.x=-Math.PI/2; keset.position.set(X,Y+.02,Z+3.9); scene.add(keset); /* keset hijau = titik keluar */
 /* sofa di dinding barat + meja kopi + TV di dinding timur */
 bx(1.15,.75,3,0x2a9d8f, -6.25,.38,-1); bx(.3,.9,3,0x238276, -6.9,1,-1); bx(1.15,.55,.3,0x238276, -6.25,.62,-2.6); bx(1.15,.55,.3,0x238276, -6.25,.62,.6); solid(-6.2,-1,1.8);
 bx(.8,.32,1.3,0x6b4423, -4.8,.16,-1); solid(-4.8,-1,.95);
 bx(.5,.5,2.2,0x4a3220, 6.55,.25,-1); solid(6.55,-1,1.15);
 var tv=new THREE.Mesh(boxGeo(.09,1.3,2.2),new THREE.MeshBasicMaterial({color:0x9fd8e8})); tv.position.set(X+6.85,Y+1.5,Z-1); scene.add(tv);
 /* tempat tidur di pojok barat laut: rangka + kasur + selimut + bantal */
 bx(3.2,.45,1.9,0x6b4423, -4.6,.22,-3.95); bx(3.2,.25,1.9,0xf5f0e6, -4.6,.56,-3.95); bx(1.7,.3,1.95,0xec407a, -3.85,.6,-3.95); bx(.7,.18,.55,0xffffff, -5.95,.72,-3.95); solid(-4.6,-3.95,2);
 /* dapur kecil di dinding utara + kulkas */
 bx(3,.95,.85,0xb8a99a, 1.6,.48,-4.55); bx(.95,2,.95,0xdfe6ea, 3.85,1,-4.5); solid(1.9,-4.5,1.8);
 /* lemari pakaian di pojok timur laut */
 bx(2.2,2.6,.7,0x6b4423, 5.7,1.3,-4.6); solid(5.7,-4.6,1.35);
 /* meja makan + 2 kursi */
 bx(1.7,.09,1.1,0x8a5a3a, 3.4,.78,1.7); bx(.18,.75,.18,0x5a3a22, 3.4,.38,1.7); bx(.5,.55,.5,0x2a9d8f, 2.25,.28,1.7); bx(.5,.55,.5,0x2a9d8f, 4.55,.28,1.7); solid(3.4,1.7,1.25);
 /* rak buku di dinding selatan (barat pintu) + buku warna-warni */
 bx(1.8,2,.4,0x6b4423, -3.6,1,4.8); solid(-3.6,4.7,1.05);
 [.9,1.35].forEach(function(sy,si){ for(var bi3=0;bi3<4;bi3++){ bx(.22,.34,.26,[0xe53935,0x1e88e5,0xffd166,0x2e9e4f][(bi3+si)%4], -4.25+bi3*.42, sy, 4.78); } });
 /* lampu lantai + tanaman pojok */
 var pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1.7,6),lamMat(0x333333)); pole.position.set(X-6.4,Y+.85,Z+1.5); scene.add(pole);
 var bulb=new THREE.Mesh(new THREE.SphereGeometry(.24,8,8),new THREE.MeshBasicMaterial({color:0xffe9a8})); bulb.position.set(X-6.4,Y+1.85,Z+1.5); scene.add(bulb);
 var pot=new THREE.Mesh(new THREE.CylinderGeometry(.34,.28,.5,8),lamMat(0xa8522e)); pot.position.set(X+6.3,Y+.25,Z+4.3); scene.add(pot);
 bx(.85,.85,.85,0x2f7d32, 6.3,1,4.3);
 /* papan nama di dinding utara */
 var sign2=new THREE.Mesh(new THREE.PlaneGeometry(3.6,1.35),new THREE.MeshBasicMaterial({map:neonTexture("RUMAH RICO","#ffd166")})); sign2.position.set(X+.4,Y+2.3,Z-4.95); scene.add(sign2);
}
buildInterior();
/* INPUT */
var keys={}, joy={x:0,y:0,id:null}, btnA=false, btnB=false, btnRevHeld=false;
/* TAHAP 5 — KEYBOARD PC LENGKAP: E masuk/keluar mobil • F serang (tahan = terus, SMG otomatis) •
   Q ganti senjata • M peta (toggle) • Esc pause (handler terpisah di bawah) • C kamera • R radio •
   H medkit • T toko. Aksi sekali-tekan dijaga e.repeat supaya menahan tombol tidak memicu beruntun. */
addEventListener("keydown",function(e){ keys[e.code]=true; if(e.repeat) return; if(e.code==="KeyE"){ if(inHouse){ if(atExitDoor()) exitHouseFn(); } else { var nhE=houseDoorNear(); if(nhE) enterHouse(nhE); else tryEnterCar(); } } if(e.code==="KeyC") cycleCam(); if(e.code==="KeyR") cycleRadio(); if(e.code==="KeyM") toggleMap(); if(e.code==="KeyF") attack(); if(e.code==="KeyQ") cycleWeapon(); if(e.code==="KeyH") useMedkit(); if(e.code==="KeyT"&&gameStarted&&!paused){ var nst=nearestShop(); if(nst) openShop(nst.id); } });
addEventListener("keyup",function(e){ keys[e.code]=false; });
var joyBase=document.getElementById("joyBase"), joyKnob=document.getElementById("joyKnob");
function joyMove(e){ var r=joyBase.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2; var dx=e.clientX-cx, dy=e.clientY-cy; var max=44, d=Math.hypot(dx,dy); if(d>max){ dx*=max/d; dy*=max/d; } joy.x=dx/max; joy.y=dy/max; joyKnob.style.transform="translate(calc(-50% + "+dx+"px),calc(-50% + "+dy+"px))"; }
joyBase.addEventListener("pointerdown",function(e){ e.preventDefault(); initAudio(); joy.id=e.pointerId; try{ joyBase.setPointerCapture(e.pointerId); }catch(err){} joyMove(e); });
joyBase.addEventListener("pointermove",function(e){ if(e.pointerId===joy.id){ e.preventDefault(); joyMove(e); } });
function joyEnd(e){ if(e.pointerId===joy.id){ joy.id=null; joy.x=0; joy.y=0; joyKnob.style.transform="translate(-50%,-50%)"; } }
joyBase.addEventListener("pointerup",joyEnd); joyBase.addEventListener("pointercancel",joyEnd); joyBase.addEventListener("lostpointercapture",joyEnd);
/* LOOK-DRAG 360° — seret jari di area kanan layar memutar kamera mengelilingi karakter.
   camYaw bebas penuh (sin/cos menangani putaran >360°), TIDAK dikunci ke belakang karakter
   dan TIDAK mengejar arah hadap pemain. camPitch lebar (-1,25..1,3 rad): pitch negatif = menengadah ke langit. */
var camYaw=0, camPitch=0.15, look={id:null,lx:0,ly:0}; /* SPEC 12:51: YAW awal 0 — kamera di SELATAN pemain menghadap UTARA, menyusuri jalan utama x=0 yang diapit gedung warna-warni, palem, mobil & zebra (dulu PI: menghadap selatan ke pantai/lapangan hijau kosong). Pitch tetap 0,15. Tetap bisa diputar bebas. */
var lookArea=document.getElementById("lookArea");
lookArea.addEventListener("pointerdown",function(e){ if(!gameStarted||paused) return; e.preventDefault(); look.id=e.pointerId; look.lx=e.clientX; look.ly=e.clientY; try{ lookArea.setPointerCapture(e.pointerId); }catch(err){} });
lookArea.addEventListener("pointermove",function(e){ if(e.pointerId!==look.id) return; e.preventDefault(); var dx=e.clientX-look.lx, dy=e.clientY-look.ly; look.lx=e.clientX; look.ly=e.clientY; camYaw+=dx*0.0055; camPitch=Math.max(-1.25,Math.min(1.3,camPitch+dy*0.003)); }); /* pitch DIPERLEBAR: dulu mentok 0,08..1,15 rad sehingga kamera tidak bisa menengadah sama sekali. Kini seret ke ATAS = pitch negatif = kamera turun rendah dan mendongak ke langit — helikopter terlihat. */
function lookEnd(e){ if(e.pointerId===look.id) look.id=null; }
lookArea.addEventListener("pointerup",lookEnd); lookArea.addEventListener("pointercancel",lookEnd); lookArea.addEventListener("lostpointercapture",lookEnd);
var bHoldTimer=null, bDownAt=0;
function bindBtn(id,down,up){ var el=document.getElementById(id); el.addEventListener("pointerdown",function(e){ e.preventDefault(); el.setPointerCapture(e.pointerId); down(); }); el.addEventListener("pointerup",function(e){ e.preventDefault(); up(); }); el.addEventListener("pointercancel",up); }
bindBtn("btnA",function(){ btnA=true; },function(){ btnA=false; });
bindBtn("btnB",function(){ btnB=true; bDownAt=performance.now(); initAudio(); if(inCar){ bHoldTimer=setTimeout(function(){ lightsOn=!lightsOn; toast(lightsOn?"💡 Lampu NYALA":"💡 Lampu MATI"); if(navigator.vibrate) navigator.vibrate(40); },1000); } else { /* TAHAP 2: di luar mobil & tidak dekat mobil/paket, B langsung MENYERANG saat ditekan; tahan = tembak terus (SMG) */
 var ncB=nearestCar(); var nearPkgB=missionIdx===0&&pkgMesh&&Math.hypot(player.position.x-pkgMesh.position.x,player.position.z-pkgMesh.position.z)<4.5; if(!ncB&&!nearPkgB){ bAuto=true; bAttacked=true; attack(); } } },function(){ btnB=false; var wasAuto=bAuto; bAuto=false; if(bHoldTimer) clearTimeout(bHoldTimer); var held=performance.now()-bDownAt; if(inCar){ if(held<1000) horn(); } else if(!wasAuto){ bAction(); } bAttacked=false; });
bindBtn("btnExit",function(){ initAudio(); exitCar(); },function(){});
bindBtn("btnRev",function(){ initAudio(); btnRevHeld=true; },function(){ btnRevHeld=false; }); /* TAHAN tombol MUNDUR = mobil mundur terus selama ditahan */
document.getElementById("btnCam").onclick=function(){ initAudio(); cycleCam(); };
document.getElementById("btnRadio").onclick=function(){ initAudio(); cycleRadio(); };
/* TAHAP 5: ganti senjata dipakai bersama tombol layar & tombol Q — hanya senjata yang DIMILIKI yang dipilih */
function cycleWeapon(){ initAudio(); if(!gameStarted||paused) return; var start=weaponIdx; do{ weaponIdx=(weaponIdx+1)%weapons.length; }while(!ownedWeapons[weaponIdx]&&weaponIdx!==start); refreshWeaponUI(); updateAB(); toast("Senjata: "+weapons[weaponIdx]); }
document.getElementById("btnWeapon").onclick=function(){ cycleWeapon(); };
document.getElementById("btnMedkit").onclick=function(){ useMedkit(); };
document.getElementById("btnPause").onclick=function(){ pauseGame(); };
document.getElementById("btnMapTop").onclick=function(){ openModal("modalMap"); drawBigMap(); };
function cycleCam(){ camMode= camMode==="chase"?"top":"chase"; var sc2=document.getElementById("setCam"); if(sc2) sc2.value=camMode; if(gameStarted) persistSave(); toast(camMode==="chase"?"📷 Chase Cam 3D":"📷 Top-Down Klasik"); }
/* TAHAP 5: M = peta sebagai TOGGLE — tekan sekali membuka (game ikut pause supaya aman membaca peta), tekan lagi / Esc menutup & lanjut main */
function toggleMap(){ if(!gameStarted) return; var mm=document.getElementById("modalMap"); if(mm.classList.contains("on")){ closeModals(); return; } document.querySelectorAll(".modal").forEach(function(m){ m.classList.remove("on"); }); paused=true; openModal("modalMap"); }
function cycleRadio(){ radioIdx=(radioIdx+1)%radios.length; noteStep=0; /* TAHAP 5: pola stasiun baru selalu mulai dari langkah pertama */ toast("📻 "+radios[radioIdx]); var rt=document.getElementById("radioToast"); rt.textContent="📻 "+radios[radioIdx]; rt.classList.add("show"); setTimeout(function(){ rt.classList.remove("show"); },2000); if(gameStarted) persistSave(); /* TAHAP 5 (lanjutan): stasiun radio terakhir ikut tersimpan */ }
var toastTimer=null; function toast(msg){ var rt=document.getElementById("radioToast"); rt.textContent=msg; rt.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(function(){ rt.classList.remove("show"); },2000); }
function centerMsg(msg){ var c=document.getElementById("centerMsg"); c.textContent=msg; c.classList.add("show"); setTimeout(function(){ c.classList.remove("show"); },2200); }
function nearestCar(){ var best=null,bd=4.2; var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z; cars.forEach(function(c){ var d=Math.hypot(c.position.x-px,c.position.z-pz); if(d<bd){ bd=d; best=c; } }); return best; }
function tryEnterCar(){ initAudio(); if(missionIdx===0&&pkgMesh&&!inCar){ var pd=Math.hypot(player.position.x-pkgMesh.position.x,player.position.z-pkgMesh.position.z); if(pd<4.5){ pickupPackage(); return; } } if(inCar){ exitCar(); return; } var nc=nearestCar(); if(nc){ if(nc.userData.burnt){ toast("🔥 Mobil ini hangus terbakar! Perbaiki di BENGKEL SEJA (dekati mobilnya, lalu buka bengkel)."); if(AC) beep(196,.2,"square",.15); return; } var jackMsg=null;
 if(!nc.userData.garageId&&!nc.userData.jacked){ var jackMoving=!nc.userData.parked; nc.userData.jacked=true; wanted=Math.min(5,wanted+(jackMoving?1:.5)); jackMsg= jackMoving? "🚨 CARJACK! Kamu merebut mobil warga — Wanted +1★" : "🚨 Kamu mengambil mobil warga yang parkir — Wanted +0,5★"; if(AC) beep(220,.25,"sawtooth",.2); } /* TAHAP 4 CARJACK: merebut mobil warga menaikkan wanted; mobil garasi milik sendiri bebas. Mobil yang sudah pernah direbut ditandai jacked — masuk lagi tidak kena wanted berulang. */
 if(wanted>0&&lastSeenCar&&nc!==lastSeenCar){ hiddenT=Math.max(hiddenT,6.5); if(!jackMsg) jackMsg="🚗 Ganti mobil — polisi mulai kehilangan jejakmu!"; } /* ganti mobil = jejak putus: wanted mulai luruh */
 inCar=nc; nc.userData.parked=false; player.visible=false; if(navigator.vibrate) navigator.vibrate(50); updateAB(); toast(jackMsg||"🚗 Gas! A = gas • 🚪 KELUAR = turun"); } }
/* KELUAR MOBIL — dulu di HP TIDAK ADA cara keluar: B di mobil = klakson/lampu, keluar cuma bisa tombol E keyboard.
   Kini tombol merah KELUAR (dan E) memanggil fungsi ini. Syarat: mobil berhenti (|carSpeed|<=2); masih jalan -> teks kecil "Berhenti dulu untuk keluar".
   Karakter ditempatkan di SAMPING mobil (tegak lurus arah mobil; coba sisi lain / depan bila sisi pertama tertutup collider),
   dan mobil ditandai parked supaya tidak kabur sendiri dibawa AI traffic. */
function exitCar(){ if(!inCar) return; if(Math.abs(carSpeed)>2){ toast("Berhenti dulu untuk keluar"); return; } var c=inCar; inCar=null; carSpeed=0; c.userData.parked=true;
 var a=c.userData.angle, sx=Math.cos(a), sz=-Math.sin(a);
 var ex=c.position.x+sx*2.4, ez=c.position.z+sz*2.4; if(collide(ex,ez)){ ex=c.position.x-sx*2.4; ez=c.position.z-sz*2.4; } if(collide(ex,ez)){ ex=c.position.x+Math.sin(a)*3.6; ez=c.position.z+Math.cos(a)*3.6; }
 player.visible=true; player.position.set(ex,0,ez); player.rotation.y=a; headlight.intensity=0; if(navigator.vibrate) navigator.vibrate(50); updateAB(); toast("🚪 Keluar mobil"); }
function updateAB(){ var icoA=document.getElementById("icoA"),labA=document.getElementById("labA"),icoB=document.getElementById("icoB"),labB=document.getElementById("labB"),bB=document.getElementById("btnB");
 if(inCar){ icoA.textContent="⚡"; labA.textContent="GAS"; icoB.textContent="📯"; labB.textContent="KLAKSON•LAMPU"; bB.classList.remove("dim"); }
 else { icoA.textContent="🏃"; labA.textContent="LARI"; var nc=nearestCar(); if(nc){ icoB.textContent="🚗"; labB.textContent="MASUK"; bB.classList.remove("dim"); } else { var cw=weapons[weaponIdx]; icoB.textContent= isGun(cw)?"🔫":(cw==="Pisau"?"🔪":"👊"); labB.textContent= isGun(cw)?"TEMBAK":(cw==="Pisau"?"TEBAS":"PUKUL"); bB.classList.remove("dim"); } }
 var bx=document.getElementById("btnExit"); if(bx) bx.classList.toggle("on", !!inCar); var br=document.getElementById("btnRev"); if(br) br.classList.toggle("on", !!inCar); if(!inCar) btnRevHeld=false; var tc=document.getElementById("touch"); if(tc) tc.classList.toggle("incar", !!inCar); }
/* ============ TAHAP 2 — COMBAT DASAR ============
   Tinju/Pisau: jarak dekat, busur hadap, cooldown singkat. Pistol/SMG/Shotgun: HITSCAN lurus ke arah
   hadap pemain (bukan auto-aim ke musuh terdekat seperti versi lama), amunisi terbatas, kilat moncong +
   tracer + suara tembak. Tahan tombol B / F = SMG menembak otomatis (cooldown mengatur laju).
   Musuh Azura ber-HP & menyerang balik (pukul; bos menembak). Pejalan kaki ber-HP, kabur saat ada
   serangan/tembakan di dekatnya, tumbang bila HP habis lalu bangkit lagi di trotoar setelah 18 detik. */
var WEAPON_STATS={ "Tinju":{dmg:12,range:2.7,cd:.34}, "Pisau":{dmg:26,range:3.1,cd:.42}, "Pistol":{dmg:30,range:32,cd:.36}, "SMG":{dmg:16,range:28,cd:.11}, "Shotgun":{dmg:55,range:15,cd:.85} };
var atkCd=0, swing=0, bAuto=false, bAttacked=false, knock={x:0,z:0}, lastCarHitAt=0, noiseBuf=null;
function gunSound(w,vol){ sfxGunshot(w,vol); } /* TAHAP 5: semua tembakan (pemain & musuh) memakai sintesis SFX khusus per senjata lewat bus sfxGain */
function alertPeds(x,z,r){ peds.forEach(function(p){ var u=p.userData; if(u.deadT>0) return; if(Math.hypot(p.position.x-x,p.position.z-z)<r){ u.fleeT=Math.max(u.fleeT||0,2.2+Math.random()*1.2); u.fleeX=x; u.fleeZ=z; } }); }
function damagePed(p,dmg,sx,sz){ var u=p.userData; if(u.deadT>0) return; u.hp=(u.hp==null?30:u.hp)-dmg; u.fleeX=sx; u.fleeZ=sz;
 if(u.hp<=0){ u.deadT=18; u.fleeT=0; p.rotation.x=Math.PI/2; p.position.y=.25; wanted=Math.min(5,wanted+1); toast("🚨 Pejalan kaki TUMBANG! Wanted +1★"); if(AC) beep(140,.3,"sawtooth",.2); if(navigator.vibrate) navigator.vibrate(80); }
 else { u.fleeT=3; toast("😱 Pejalan kaki terluka — dia kabur!"); }
 alertPeds(p.position.x,p.position.z,11); }
function meleeHit(w,st,fx,fz){ var hit=false;
 function inArc(tx,tz){ var dx=tx-player.position.x, dz=tz-player.position.z, d=Math.hypot(dx,dz); if(d>st.range) return false; if(d<.9) return true; return (dx*fx+dz*fz)/d>.15; }
 if(missionIdx===4){ var best=null,bd=1e9; azura.forEach(function(e){ if(!e.alive||(e.isBoss&&!bossActive)) return; if(inArc(e.mesh.position.x,e.mesh.position.z)){ var d=Math.hypot(e.mesh.position.x-player.position.x,e.mesh.position.z-player.position.z); if(d<bd){ bd=d; best=e; } } }); if(best){ damageAzura(best,st.dmg); hit=true; } }
 if(!hit&&typeof sideFoe!=="undefined"&&sideFoe&&sideFoe.alive&&inArc(sideFoe.mesh.position.x,sideFoe.mesh.position.z)){ sideDamage(sideFoe,st.dmg); hit=true; } /* TAHAP 4: target misi Buru Target bisa dipukul/ditebas */
 if(!hit){ for(var i=0;i<peds.length;i++){ var p=peds[i]; if(p.userData.deadT>0) continue; if(inArc(p.position.x,p.position.z)){ damagePed(p,st.dmg,player.position.x,player.position.z); wanted=Math.min(5,wanted+.7); hit=true; break; } } }
 if(AC) beep(w==="Tinju"?170:320,.09,"square",.16); if(navigator.vibrate) navigator.vibrate(35); alertPeds(player.position.x,player.position.z,6);
 if(!hit) toast(w==="Tinju"?"👊 Pukulan meleset — tidak ada yang kena":"🔪 Tebasan meleset"); }
function hitscan(fx,fz,st,w){ var range=st.range, spread= w==="Shotgun"?.13 : w==="SMG"?.055 : .034, cand=[];
 function scan(tx,tz,kind,ref){ var dx=tx-player.position.x, dz=tz-player.position.z, d=Math.hypot(dx,dz); if(d<.6||d>range) return; var dot=(dx*fx+dz*fz)/d; if(dot<.5) return; var perp=d*Math.sqrt(Math.max(0,1-dot*dot)); if(perp>.85+d*spread) return; cand.push({d:d,perp:perp,kind:kind,ref:ref,x:tx,z:tz}); }
 if(missionIdx===4) azura.forEach(function(e){ if(e.alive&&(!e.isBoss||bossActive)) scan(e.mesh.position.x,e.mesh.position.z,"azura",e); });
 if(typeof sideFoe!=="undefined"&&sideFoe&&sideFoe.alive) scan(sideFoe.mesh.position.x,sideFoe.mesh.position.z,"side",sideFoe); /* TAHAP 4: target Buru Target bisa ditembak */
 peds.forEach(function(p){ if(!(p.userData.deadT>0)) scan(p.position.x,p.position.z,"ped",p); });
 cars.forEach(function(c){ if(!c.userData.burnt) scan(c.position.x,c.position.z,"car",c); }); /* TAHAP 3: mobil bisa ditembak — health mobil turun dan bisa meledak */
 cand.sort(function(a,b){ return (a.perp*8+a.d*.06)-(b.perp*8+b.d*.06); });
 var mx=player.position.x+fx*.8, mz=player.position.z+fz*.8; muzzleFlash(mx,1.35,mz);
 if(!cand.length){ fireTracer(mx,1.35,mz, player.position.x+fx*range,1.15,player.position.z+fz*range, 0xffe9a8); return false; }
 var c=cand[0]; fireTracer(mx,1.35,mz, c.x,1.1,c.z, 0xffe9a8);
 var dmg=st.dmg; if(w==="Shotgun") dmg=Math.max(18,Math.round(st.dmg*(1.15-c.d/range*.7)));
 if(c.kind==="azura") damageAzura(c.ref,dmg); else if(c.kind==="side") sideDamage(c.ref,dmg); else if(c.kind==="car"){ damageCar(c.ref,dmg); if(!c.ref.userData.burnt) toast("🚗 Mobil kena tembak! Health mobil: "+Math.max(0,Math.round(c.ref.userData.hp))+"%"); } else { damagePed(c.ref,dmg,player.position.x,player.position.z); wanted=Math.min(5,wanted+.35); }
 return true; }
/* TAHAP 1 — AUTO-AIM: cari musuh Azura/bos TERDEKAT di dalam kerucut ±30° (total ~60°) di depan pemain
   dan di dalam jangkauan senjata aktif. Pejalan kaki TIDAK pernah jadi target auto-aim — mereka hanya kena
   bila pemain mengarahkan hadapnya sendiri (hitscan/melee manual seperti sebelumnya), supaya wanted tidak
   naik tanpa sengaja. Skor = jarak dikurangi bonus arah hadap, jadi yang paling lurus di depan didahulukan. */
function findAimTarget(st){ if(!autoAim) return null; if(missionIdx!==4&&!(typeof sideFoe!=="undefined"&&sideFoe&&sideFoe.alive)) return null; var fx=Math.sin(player.rotation.y), fz=Math.cos(player.rotation.y); var best=null, bs=1e9;
 if(missionIdx===4) azura.forEach(function(e){ if(!e.alive||(e.isBoss&&!bossActive)) return; var dx=e.mesh.position.x-player.position.x, dz=e.mesh.position.z-player.position.z, d=Math.hypot(dx,dz); if(d>st.range||d<.4) return; var dot=(dx*fx+dz*fz)/d; if(d>1.2&&dot<.866) return; /* di luar kerucut 60° (kecuali menempel) */
  var score=d-dot*2.5; if(score<bs){ bs=score; best=e; } });
 if(typeof sideFoe!=="undefined"&&sideFoe&&sideFoe.alive){ var dx2=sideFoe.mesh.position.x-player.position.x, dz2=sideFoe.mesh.position.z-player.position.z, d2=Math.hypot(dx2,dz2); if(d2<=st.range&&d2>=.4){ var dot2=(dx2*fx+dz2*fz)/d2; if(!(d2>1.2&&dot2<.866)){ var sc2=d2-dot2*2.5; if(sc2<bs){ bs=sc2; best=sideFoe; } } } } /* TAHAP 4: auto-aim juga mengunci target Buru Target */
 return best; }
function attack(){ if(inCar||dialogueActive||paused||!gameStarted) return; if(atkCd>0) return; var w=weapons[weaponIdx]; var st=WEAPON_STATS[w]; if(!st) return; tutDidAttack=true; /* ROUND 10: penanda untuk auto-maju tutorial langkah 4 */
 /* TAHAP 1: sebelum menembak/memukul, putar hadap pemain MULUS ke target auto-aim (80% jalan pintas busur
    sekarang, sisanya diselesaikan updateCombatFx dalam ~0,3 detik) lalu kunci cincin penanda di kakinya */
 var aimE=findAimTarget(st);
 if(aimE){ var taA=Math.atan2(aimE.mesh.position.x-player.position.x, aimE.mesh.position.z-player.position.z); var dAA=taA-player.rotation.y; while(dAA>Math.PI)dAA-=Math.PI*2; while(dAA<-Math.PI)dAA+=Math.PI*2; player.rotation.y+=dAA*.8; playerAngle=player.rotation.y; aimFaceTo=taA; aimFaceT=.3; aimTarget=aimE; aimLockUntil=performance.now()+750; }
 var fx=Math.sin(player.rotation.y), fz=Math.cos(player.rotation.y);
 if(!isGun(w)){ atkCd=st.cd; swing=.0001; meleeHit(w,st,fx,fz); return; }
 if((ammo[w]||0)<=0){ atkCd=.3; toast("🔫 Peluru "+w+" HABIS! Beli amunisi di TOKO SEJA."); if(AC) beep(220,.08,"square",.12); return; }
 atkCd=st.cd; swing=.0001; ammo[w]--; gunSound(w,1); if(navigator.vibrate) navigator.vibrate(30); wanted=Math.min(5,wanted+.2); alertPeds(player.position.x,player.position.z,21);
 hitscan(fx,fz,st,w); updateHUD(); refreshWeaponUI(); }
function bAction(){ if(missionIdx===0&&pkgMesh&&!inCar){ var pd=Math.hypot(player.position.x-pkgMesh.position.x,player.position.z-pkgMesh.position.z); if(pd<4.5){ pickupPackage(); return; } } if(nearestCar()){ tryEnterCar(); return; } attack(); }
function updateCombatFx(dt,now){ if(atkCd>0) atkCd-=dt;
 /* SENJATA DI TANGAN: model prop mengikuti senjata aktif (dibangun ulang hanya saat berganti) */
 var cw2=weapons[weaponIdx]; var wantProp= isGun(cw2)? (cw2==="Shotgun"?"shotgun":(cw2==="SMG"?"smg":"gun")) : (cw2==="Pisau"?"knife":null);
 if(player.userData.propKind!==wantProp) setHandProp(player,wantProp);
 if(swing>0){ swing+=dt*4.2; if(swing>=1) swing=0; else if(player.userData.armR) player.userData.armR.rotation.x=-2.3*Math.sin(swing*Math.PI); }
 flashSprite.visible= now<flashUntil;
 tracers.forEach(function(t){ t.line.material.opacity= now>t.until? 0 : .15+.8*(t.until-now)/95; });
 /* TAHAP 1: selesaikan putaran hadap ke target auto-aim dengan mulus + gerakkan cincin penanda mengikuti kaki target */
 if(aimFaceT>0&&aimFaceTo!==null){ aimFaceT-=dt; var dAF=aimFaceTo-player.rotation.y; while(dAF>Math.PI)dAF-=Math.PI*2; while(dAF<-Math.PI)dAF+=Math.PI*2; player.rotation.y+=dAF*Math.min(1,dt*16); playerAngle=player.rotation.y; if(aimFaceT<=0) aimFaceTo=null; }
 if(aimTarget&&aimTarget.alive&&now<aimLockUntil){ aimRing.visible=true; aimRing.position.x=aimTarget.mesh.position.x; aimRing.position.z=aimTarget.mesh.position.z; var rp=1+Math.sin(now*.018)*.1; aimRing.scale.set(rp,rp,1); } else aimRing.visible=false; }
document.getElementById("btnB").addEventListener("dblclick",function(e){ e.preventDefault(); });
/* ============ TOKO SEJA: logika beli / pakai / garasi ============ */
function isGun(w){ return w==="Pistol"||w==="SMG"||w==="Shotgun"; }
function refreshWeaponUI(){ var w=weapons[weaponIdx]; document.getElementById("weapon").textContent= isGun(w)? w+" • "+(ammo[w]||0) : w; document.getElementById("btnWeapon").textContent=["👊","🔪","🔫","💥","💣"][weaponIdx]; }
function applyOutfit(id){ var o=null; OUTFITS.forEach(function(x){ if(x.id===id) o=x; }); if(!o) o=OUTFITS[0]; currentOutfit=o.id; try{ player.userData.body.material.color.setHex(o.shirt); player.userData.armL.children[0].material.color.setHex(o.shirt); player.userData.armR.children[0].material.color.setHex(o.shirt); player.userData.legL.children[0].material.color.setHex(o.pants); }catch(e){} }
var garageCars=[];
var GARAGE_SPOTS=[{x:-4,z:90},{x:-11,z:90},{x:-18,z:90}];
function spawnGarageCar(id){ var def=null; SHOP_CARS.forEach(function(c){ if(c.id===id) def=c; }); if(!def) return; var spot=GARAGE_SPOTS[garageCars.length%GARAGE_SPOTS.length]; var car=makeCar(def.color,false); car.position.set(spot.x,0,spot.z); car.userData.horiz=false; car.userData.dir=1; car.userData.spd=0; car.userData.angle=Math.PI; car.userData.parked=true; car.userData.maxSpd=def.maxSpd; car.userData.garageId=id; car.rotation.y=Math.PI; scene.add(car); cars.push(car); garageCars.push(car); }
function clearGarageCars(){ garageCars.forEach(function(c){ scene.remove(c); var i=cars.indexOf(c); if(i>=0) cars.splice(i,1); if(inCar===c){ inCar=null; player.visible=true; headlight.intensity=0; } }); garageCars=[]; }
function resetShopState(){ ownedWeapons=[true,false,false,false,false]; ammo={Pistol:0,SMG:0,Shotgun:0}; ownedCars=[]; ownedOutfits=["santai"]; currentOutfit="santai"; weaponIdx=0; medkits=0; clearGarageCars(); applyOutfit("santai"); refreshWeaponUI(); }
function applySavedShop(){ resetShopState(); if(!saveData) return; if(Object.prototype.toString.call(saveData.weapons)==="[object Array]"){ for(var i=0;i<weapons.length;i++) ownedWeapons[i]=!!saveData.weapons[i]; ownedWeapons[0]=true; } if(saveData.ammo){ for(var k in ammo) if(typeof saveData.ammo[k]==="number") ammo[k]=saveData.ammo[k]; } if(Object.prototype.toString.call(saveData.outfits)==="[object Array]"){ saveData.outfits.forEach(function(id){ if(ownedOutfits.indexOf(id)<0) ownedOutfits.push(id); }); } if(saveData.outfit&&ownedOutfits.indexOf(saveData.outfit)>=0) applyOutfit(saveData.outfit); if(Object.prototype.toString.call(saveData.cars)==="[object Array]"){ saveData.cars.forEach(function(id){ if(ownedCars.indexOf(id)<0){ ownedCars.push(id); spawnGarageCar(id); } }); } if(typeof saveData.weaponIdx==="number"&&ownedWeapons[saveData.weaponIdx]) weaponIdx=saveData.weaponIdx;
 if(typeof saveData.medkits==="number") medkits=Math.max(0,Math.min(5,saveData.medkits)); /* TAHAP 3: pulihkan medkit + kondisi (health/bensin/hangus) mobil garasi */
 if(saveData.carState){ garageCars.forEach(function(c){ var st=saveData.carState[c.userData.garageId]; if(st){ if(typeof st.hp==="number") c.userData.hp=st.hp; if(typeof st.fuel==="number") c.userData.fuel=st.fuel; if(st.burnt){ c.userData.burnt=true; c.userData.burnT=0; if(c.userData.bodyMat) c.userData.bodyMat.color.setHex(0x17181c); } } }); }
 refreshWeaponUI(); }
function openShop(id){ if(!gameStarted) return; initAudio(); curShop= id? id : (nearShop? nearShop.id : "toko"); document.querySelectorAll(".modal").forEach(function(m){ m.classList.remove("on"); }); paused=true; renderShop(); document.getElementById("modalShop").classList.add("on"); var sl=document.getElementById("shopList"); if(sl) sl.scrollTop=0; }
function renderShop(){ var shop=shopById(curShop), secs=shop.secs; document.getElementById("shopTitle").textContent="🛒 "+shop.name; document.getElementById("shopIntro").textContent=shop.intro; document.getElementById("shopMoney").textContent=money; var h="";
 function row(name,desc,label,dis,attr){ return '<div class="shopItem"><div><div class="siName">'+name+'</div><div class="siDesc">'+desc+'</div></div><button data-buy="'+attr+'"'+(dis?" disabled":"")+'>'+label+'</button></div>'; }
 if(secs.indexOf("weapons")>=0){ h+='<div class="shopSec">🔫 SENJATA</div>';
  SHOP_WEAPONS.forEach(function(w){ var idx=weapons.indexOf(w.id), owned=ownedWeapons[idx]; var desc=w.desc+(isGun(w.id)?" Amunisi sekarang: "+(ammo[w.id]||0)+".":""); if(owned) h+=row(w.id,desc, weaponIdx===idx?"DIPAKAI ✓":"PAKAI", weaponIdx===idx, "weapon|"+w.id); else h+=row(w.id,desc,"BELI $"+w.price, money<w.price, "weapon|"+w.id); }); }
 if(secs.indexOf("ammo")>=0){ h+='<div class="shopSec">🎯 AMUNISI</div>';
  SHOP_AMMO.forEach(function(a){ var owned=ownedWeapons[weapons.indexOf(a.id)]; h+=row(a.label, owned?("Amunisi "+a.id+" sekarang: "+(ammo[a.id]||0)+"."):("Beli "+a.id+" dulu untuk bisa membeli amunisi ini."), "BELI $"+a.price, !owned||money<a.price, "ammo|"+a.id); }); }
 if(secs.indexOf("medkit")>=0){ h+='<div class="shopSec">✚ MEDKIT</div>';
  h+=row("Medkit","Pulihkan +50 HP kapan saja (tombol 💊 di layar / tombol H). Kamu punya: "+medkits+" / 5.","BELI $45", money<45||medkits>=5, "medkit|1"); }
 if(secs.indexOf("repair")>=0){ h+='<div class="shopSec">🔧 PERBAIKAN MOBIL</div>'; var rc=serviceCar();
  if(!rc) h+=row("Perbaiki Mobil","Tidak ada mobil dalam jangkauan — bawa mobilmu mendekat ke bengkel dulu.","—",true,"none|0");
  else if(rc.userData.burnt) h+=row("Bangun Ulang Mobil Meledak","Mobil terdekat hangus terbakar. Bangun ulang total: health kembali 100%, bodi seperti baru.","PERBAIKI $120", money<120, "repair|1");
  else if(rc.userData.hp>=99.5) h+=row("Perbaiki Mobil","Mobil terdekat masih mulus (health "+Math.round(rc.userData.hp)+"%).","MULUS ✓",true,"none|0");
  else { var rcost=Math.max(15,Math.ceil((100-rc.userData.hp)*0.9)); h+=row("Perbaiki Mobil","Health mobil terdekat: "+Math.round(rc.userData.hp)+"% → 100%. Asap hilang, bodi kinclong lagi.","PERBAIKI $"+rcost, money<rcost, "repair|1"); } }
 if(secs.indexOf("fuel")>=0){ h+='<div class="shopSec">⛽ BENSIN</div>'; var fc=serviceCar();
  if(!fc) h+=row("Isi Bensin","Tidak ada mobil dalam jangkauan — bawa mobilmu mendekat dulu.","—",true,"none|0");
  else if(fc.userData.fuel>=99.5) h+=row("Isi Bensin","Tangki mobil terdekat sudah penuh (100%).","PENUH ✓",true,"none|0");
  else { var fcost=Math.max(5,Math.ceil((100-fc.userData.fuel)*0.3)); h+=row("Isi Bensin","Bensin mobil terdekat: "+Math.round(fc.userData.fuel)+"% → 100%.","ISI $"+fcost, money<fcost, "fuel|1"); } }
 if(secs.indexOf("cars")>=0){ h+='<div class="shopSec">🚗 MOBIL — menunggu di GARASI selatan titik awal</div>';
  SHOP_CARS.forEach(function(c){ var owned=ownedCars.indexOf(c.id)>=0; h+=row(c.name,c.desc, owned?"DIMILIKI ✓":"BELI $"+c.price, owned||money<c.price, "car|"+c.id); }); }
 if(secs.indexOf("outfits")>=0){ h+='<div class="shopSec">👕 PAKAIAN — langsung dipakai saat dibeli</div>';
  OUTFITS.forEach(function(o){ var owned=ownedOutfits.indexOf(o.id)>=0; if(owned) h+=row(o.name,o.desc, currentOutfit===o.id?"DIPAKAI ✓":"PAKAI", currentOutfit===o.id, "outfit|"+o.id); else h+=row(o.name,o.desc,"BELI $"+o.price, money<o.price, "outfit|"+o.id); }); }
 document.getElementById("shopList").innerHTML=h;
 document.querySelectorAll("#shopList [data-buy]").forEach(function(b){ b.onclick=function(){ buyItem(b.getAttribute("data-buy")); }; });
}
function buyItem(spec){ var parts=spec.split("|"), kind=parts[0], id=parts[1];
 if(kind==="weapon"){ var w=null; SHOP_WEAPONS.forEach(function(x){ if(x.id===id) w=x; }); var idx=weapons.indexOf(id); if(ownedWeapons[idx]){ weaponIdx=idx; toast("🔫 "+id+" dipakai"); } else { if(!w||money<w.price){ toast("💸 Uang tidak cukup!"); return; } money-=w.price; ownedWeapons[idx]=true; if(isGun(id)) ammo[id]=(ammo[id]||0)+w.startAmmo; weaponIdx=idx; toast("✅ "+id+" dibeli & langsung dipakai!"); if(navigator.vibrate) navigator.vibrate(50); } }
 else if(kind==="ammo"){ var a=null; SHOP_AMMO.forEach(function(x){ if(x.id===id) a=x; }); if(!a||money<a.price){ toast("💸 Uang tidak cukup!"); return; } money-=a.price; ammo[id]=(ammo[id]||0)+a.n; toast("🎯 +"+a.n+" amunisi "+id); }
 else if(kind==="car"){ var c=null; SHOP_CARS.forEach(function(x){ if(x.id===id) c=x; }); if(!c||ownedCars.indexOf(id)>=0) return; if(money<c.price){ toast("💸 Uang tidak cukup!"); return; } money-=c.price; ownedCars.push(id); spawnGarageCar(id); toast("🚗 "+c.name+" menunggu di GARASI!"); if(navigator.vibrate) navigator.vibrate(60); }
 else if(kind==="outfit"){ var o=null; OUTFITS.forEach(function(x){ if(x.id===id) o=x; }); if(!o) return; if(ownedOutfits.indexOf(id)>=0){ applyOutfit(id); toast("👕 "+o.name+" dipakai"); } else { if(money<o.price){ toast("💸 Uang tidak cukup!"); return; } money-=o.price; ownedOutfits.push(id); applyOutfit(id); toast("✅ "+o.name+" dibeli & langsung dipakai!"); } }
 else if(kind==="medkit"){ if(medkits>=5){ toast("💊 Tas medkit sudah penuh (5)!"); return; } if(money<45){ toast("💸 Uang tidak cukup!"); return; } money-=45; medkits++; toast("💊 Medkit dibeli! Kamu punya "+medkits+" — pakai dengan tombol 💊 / H."); }
 else if(kind==="repair"){ var rc2=serviceCar(); if(!rc2){ toast("🚗 Tidak ada mobil di dekat sini."); return; } if(!rc2.userData.burnt&&rc2.userData.hp>=99.5){ toast("🚗 Mobil masih mulus."); return; } var cost2= rc2.userData.burnt? 120 : Math.max(15,Math.ceil((100-rc2.userData.hp)*0.9)); if(money<cost2){ toast("💸 Uang tidak cukup!"); return; } money-=cost2; rc2.userData.hp=100; if(rc2.userData.burnt){ rc2.userData.burnt=false; rc2.userData.burnT=0; if(rc2.userData.bodyMat) rc2.userData.bodyMat.color.setHex(rc2.userData.origColor); } toast("🔧 Mobil diperbaiki! Health 100%"); if(navigator.vibrate) navigator.vibrate(50); }
 else if(kind==="fuel"){ var fc2=serviceCar(); if(!fc2){ toast("🚗 Tidak ada mobil di dekat sini."); return; } if(fc2.userData.fuel>=99.5){ toast("⛽ Tangki sudah penuh."); return; } var fcost2=Math.max(5,Math.ceil((100-fc2.userData.fuel)*0.3)); if(money<fcost2){ toast("💸 Uang tidak cukup!"); return; } money-=fcost2; fc2.userData.fuel=100; fc2.userData.fuelWarned=false; fc2.userData.fuelEmpty=false; toast("⛽ Tangki penuh! Selamat jalan."); }
 updateHUD(); refreshWeaponUI(); persistSave(); renderShop(); }
document.getElementById("btnShopFloat").onclick=function(){ openShop(); };
document.getElementById("btnHouseFloat").onclick=function(){ initAudio(); if(inHouse){ if(atExitDoor()) exitHouseFn(); else toast("🏠 Pergi ke pintu (keset hijau) untuk keluar rumah."); } else { var nh=houseDoorNear(); if(nh) enterHouse(nh); } };
/* MENU */
var menuItems=[].slice.call(document.querySelectorAll(".menuBtn")); var selIdx=1;
function selectMenu(i){ selIdx=i; menuItems.forEach(function(b,j){ b.classList.toggle("sel", j===i && !b.classList.contains("disabled")); }); }
menuItems.forEach(function(b,i){ b.addEventListener("click",function(){ initAudio(); selectMenu(i); var act=b.getAttribute("data-act"); if(act==="new") startGame(false); else if(act==="continue"&&hasSave) startGame(true); else if(act==="controls") openModal("modalControls"); else if(act==="settings") openModal("modalSettings"); }); b.addEventListener("mouseenter",function(){ selectMenu(i); }); });
addEventListener("keydown",function(e){ if(!gameStarted){ if(e.code==="ArrowDown") selectMenu(Math.min(3,selIdx+1)); if(e.code==="ArrowUp") selectMenu(Math.max(0,selIdx-1)); if(e.code==="Enter") menuItems[selIdx].click(); } });
function openModal(id){ document.getElementById(id).classList.add("on"); if(id==="modalMap") drawBigMap(); }
function closeModals(){ document.querySelectorAll(".modal").forEach(function(m){ m.classList.remove("on"); }); paused=false; }
document.querySelectorAll("[data-close]").forEach(function(b){ b.onclick=closeModals; });
/* TOKO: menutup toko cukup dengan tombol TUTUP TOKO di bawah kartu, ketuk di luar kartu, atau Esc (tombol X pojok dihapus atas permintaan user) */
document.querySelectorAll(".modal").forEach(function(mo){ mo.addEventListener("pointerdown",function(e){ if(e.target===mo&&mo.id!=="modalFail"&&mo.id!=="modalEnding") closeModals(); }); });
document.getElementById("btnDialogNext").onclick=function(){ initAudio(); nextDialogue(); };
document.getElementById("btnRetryMission").onclick=function(){ initAudio(); restartCurrentMission(); };
document.getElementById("btnPlayAgain").onclick=function(){ initAudio(); document.getElementById("modalEnding").classList.remove("on"); startGame(false); };
document.getElementById("btnFreeRoam").onclick=function(){ initAudio(); closeModals(); centerMsg("JELAJAH BEBAS"); toast("Kota Seja bebas — jelajahi sesukamu! Misi sampingan tetap tersedia lewat tombol 🎯, atau tekan MAIN LAGI di akhir permainan berikutnya untuk reset progres."); };
/* TAHAP 5: Esc = PAUSE bila sedang main tanpa modal terbuka; bila ada modal terbuka, Esc menutupnya
   (termasuk menu Pause = lanjut main). Modal gagal/tamat tidak bisa di-Esc. Tutorial dilewati lewat Esc. */
addEventListener("keydown",function(e){ if(e.code!=="Escape"||e.repeat) return; if(failShowing||gameFinished) return; if(tutActive){ endTutorial(); return; } /* ROUND 10: tutorial kini kartu kecil, bukan modal — Esc tetap melewatinya */ if(perfPromptOpen){ declinePerfOffer(); return; } /* Esc di banner performa = menolak (ditunda 5 menit), bukan menutup diam-diam */ var anyOn=false; document.querySelectorAll(".modal").forEach(function(mo){ if(mo.classList.contains("on")) anyOn=true; }); if(anyOn){ closeModals(); return; } if(gameStarted&&!paused&&!dialogueActive) pauseGame(); });
function pauseGame(){ if(perfPromptOpen) declinePerfOffer(); /* ROUND 10: pause saat banner tampil = tawarannya ditutup (ditunda 5 menit) */ persistSave(); paused=true; document.getElementById("pauseStats").innerHTML="💰 Uang: $"+money+"<br>⭐ Wanted: "+Math.floor(wanted)+"<br>🎯 Misi: "+(missionIdx+1)+" / "+missions.length+" — "+(missions[missionIdx]?missions[missionIdx].t:"Selesai")+"<br>🔫 Senjata: "+weapons[weaponIdx]; openModal("modalPause"); }
document.getElementById("btnResume").onclick=closeModals; document.getElementById("btnResume2").onclick=closeModals;
document.getElementById("btnShop").onclick=function(){ openShop(); };
document.getElementById("btnToMap").onclick=function(){ closeModals(); openModal("modalMap"); };
document.getElementById("btnShowDebug").onclick=function(){ closeModals(); showDebugOverlay(); };
document.getElementById("btnToMenu").onclick=function(){ persistSave(); closeModals(); hidePerfBanner(); perfPromptOpen=false; gameStarted=false; document.getElementById("menu").style.display="flex"; document.getElementById("hud").classList.remove("on"); document.getElementById("touch").classList.remove("on"); hideDebugOverlay(); };
/* TAHAP 5 (lanjutan) — PENGATURAN: terapkan / tangkap / pulihkan. Kualitas, volume musik & ambient,
   kamera default, getaran, dan auto-aim kini semua hidup sebagai state (qualityLow/musicVol/ambVol/
   camMode/vibOn/autoAim) yang ditulis ke save oleh persistSave dan dipulihkan oleh loadSave/Continue. */
function applyQuality(low){ qualityLow=!!low; var sq=document.getElementById("setQuality"); if(sq) sq.value=qualityLow?"low":"high"; if(!renderer) return; renderer.setPixelRatio(qualityLow?1:Math.min(window.devicePixelRatio||1,2)); renderer.shadowMap.enabled=!qualityLow; if(typeof sun!=="undefined"&&sun) sun.castShadow=!qualityLow; }
function captureSettings(){ return {quality:qualityLow?"low":"high",music:musicVol,amb:ambVol,cam:camMode,vib:vibOn,autoAim:autoAim}; }
function applySettingsToUI(){ var sq=document.getElementById("setQuality"); if(sq) sq.value=qualityLow?"low":"high"; var sm=document.getElementById("setMusic"); if(sm) sm.value=musicVol; var sab=document.getElementById("setAmb"); if(sab) sab.value=ambVol; var sc=document.getElementById("setCam"); if(sc) sc.value=camMode; var sv=document.getElementById("setVib"); if(sv) sv.value=vibOn?"on":"off"; var saa=document.getElementById("setAutoAim"); if(saa) saa.value=autoAim?"on":"off"; }
function applySettings(s){ if(!s||typeof s!=="object") return; if(s.quality==="low"||s.quality==="high") applyQuality(s.quality==="low"); if(typeof s.music==="number"){ musicVol=Math.max(0,Math.min(100,s.music)); if(musicGain) musicGain.gain.value=musicVol/100*.5; } if(typeof s.amb==="number"){ ambVol=Math.max(0,Math.min(100,s.amb)); if(ambGain) ambGain.gain.value=ambVol/100*.45; } if(s.cam==="chase"||s.cam==="top") camMode=s.cam; if(typeof s.vib==="boolean") vibOn=s.vib; if(typeof s.autoAim==="boolean") autoAim=s.autoAim; applySettingsToUI(); }
document.getElementById("setQuality").onchange=function(e){ applyQuality(e.target.value==="low"); if(gameStarted) persistSave(); };
document.getElementById("setCam").onchange=function(e){ camMode=e.target.value; if(gameStarted) persistSave(); };
document.getElementById("setAutoAim").onchange=function(e){ autoAim= e.target.value==="on"; if(gameStarted) persistSave(); }; /* TAHAP 1: toggle auto-aim, tersimpan di save */
document.getElementById("setVib").onchange=function(e){ vibOn= e.target.value==="on"; if(gameStarted) persistSave(); }; /* TAHAP 5: getaran kini benar-benar menyala/mati (pembungkus navigator.vibrate) dan tersimpan */
document.getElementById("setMusic").oninput=function(e){ musicVol=+e.target.value; if(musicGain) musicGain.gain.value=musicVol/100*.5; };
document.getElementById("setMusic").onchange=function(){ if(gameStarted) persistSave(); };
document.getElementById("setAmb").oninput=function(e){ ambVol=+e.target.value; if(ambGain) ambGain.gain.value=ambVol/100*.45; };
document.getElementById("setAmb").onchange=function(){ if(gameStarted) persistSave(); };
/* TAHAP 5 (lanjutan) — DETEKSI PERFORMA: FPS dihitung dari frame nyata selama main (menu & pause
   tidak dihitung). Bila FPS tiap detik tetap < 30 selama 10 detik penuh, pemain DITAWARI pindah
   ke kualitas Hemat lewat BANNER KECIL di sudut layar (ROUND 10: bukan lagi dialog layar penuh
   yang mem-pause game — banner tidak memblokir pandangan/joystick, game tetap jalan).
   Banner TIDAK muncul dalam 30 detik pertama permainan, tidak muncul saat pause atau tutorial,
   dan bila ditutup (TUTUP / Esc) tawarannya ditunda 5 menit. Logika deteksi FPS tidak diubah. */
var perfFrames=0, perfTime=0, perfLowSince=0, perfMutedUntil=0, perfPromptOpen=false, gameStartAt=0;
function hidePerfBanner(){ var b=document.getElementById("perfBanner"); if(b) b.classList.remove("on"); }
function perfCheck(dt,now){ if(qualityLow||liteMode||perfPromptOpen||now<perfMutedUntil){ perfFrames=0; perfTime=0; perfLowSince=0; return; } if(!gameStarted||paused||tutActive){ perfFrames=0; perfTime=0; perfLowSince=0; return; } if(gameStartAt&&now-gameStartAt<30000){ perfFrames=0; perfTime=0; perfLowSince=0; return; } /* ROUND 10: 30 detik pertama bebas tawaran — kesan pertama tidak boleh diganggu */ perfFrames++; perfTime+=dt; if(perfTime<1) return; var avg=perfFrames/perfTime; perfFrames=0; perfTime=0; if(avg<30){ if(!perfLowSince) perfLowSince=now; else if(now-perfLowSince>=10000) showPerfPrompt(Math.round(avg)); } else perfLowSince=0; }
function showPerfPrompt(avg){ perfPromptOpen=true; perfLowSince=0; var pt=document.getElementById("perfText"); if(pt) pt.innerHTML="⚡ FPS rata-rata sekitar <b>"+avg+"</b> — perangkat kewalahan di kualitas Tinggi."; var b=document.getElementById("perfBanner"); if(b) b.classList.add("on"); if(AC) beep(520,.12,"sine",.12); }
function declinePerfOffer(){ perfPromptOpen=false; perfMutedUntil=performance.now()+300000; perfLowSince=0; hidePerfBanner(); toast("Baik, kualitas Tinggi dipertahankan — tawaran Hemat ditunda 5 menit."); }
document.getElementById("btnPerfYes").onclick=function(){ initAudio(); perfPromptOpen=false; applyQuality(true); hidePerfBanner(); persistSave(); toast("⚡ Kualitas HEMAT aktif — resolusi diturunkan & bayangan mati supaya FPS naik. Bisa diubah lagi di Settings."); };
document.getElementById("btnPerfNo").onclick=function(){ initAudio(); declinePerfOffer(); };
/* SAVE PERSISTEN — akar masalah "balik ke awal, progres hilang": versi lama saveData HANYA variabel RAM yang diisi
   HANYA saat misi selesai; tidak ada localStorage sama sekali di game ini. Begitu webview ke-reload (scene 1.300+
   objek berat di HP — webview gampang di-reload sistem/tekanan memori) atau game ditutup-lalu-dibuka, save lenyap
   dan CONTINUE selalu "No saved game yet". Kini progres (uang, misi, nyawa, POSISI) ditulis ke localStorage:
   autosave tiap 5 detik saat main + saat misi selesai + tertangkap + pause + ke menu + halaman disembunyikan/ditutup.
   Semua akses dibungkus try/catch: bila penyimpanan diblokir iframe, save tetap hidup di RAM seperti sebelumnya. */
var SAVE_KEY="kotaSejaSaveV1";
function refreshContinueBtn(){ if(!hasSave||!saveData) return; var bc=document.getElementById("btnContinue"); if(bc) bc.classList.remove("disabled"); var nt=document.getElementById("continueNote"); if(nt){ var lbl="$"+saveData.money+" • "+(saveData.missionIdx<missions.length? "Misi "+(saveData.missionIdx+1) : "Kota bebas"); if(saveData.missionIdx===4&&saveData.m5) lbl+=" — "+(saveData.m5.down||0)+"/6 anak buah Azura sudah tumbang"; if(typeof saveData.clockT==="number"){ var ch=Math.floor(saveData.clockT), cm2=Math.floor((saveData.clockT-ch)*60); lbl+=" • 🕐 "+(ch<10?"0":"")+ch+":"+(cm2<10?"0":"")+cm2; } nt.textContent=lbl; } }
function persistSave(){ var sx= inHouse? inHouse.rx : (inCar?inCar.position.x:player.position.x), sz= inHouse? inHouse.rz : (inCar?inCar.position.z:player.position.z); /* di dalam rumah: simpan posisi PINTU rumah (titik kembali), BUKAN koordinat interior — Continue menaruh pemain di depan rumahnya */ var carState={}; garageCars.forEach(function(c){ if(c.userData.garageId) carState[c.userData.garageId]={hp:c.userData.hp,fuel:c.userData.fuel,burnt:!!c.userData.burnt}; }); var m5=null; if(missionIdx===4&&typeof azura!=="undefined"&&azura.length){ var dn=0,bHp=null,bDead=false; azura.forEach(function(e){ if(e.isBoss){ bHp=Math.max(0,Math.ceil(e.hp)); bDead=!e.alive; } else if(!e.alive) dn++; }); m5={down:dn,bossActive:!!bossActive,bossHp:bHp,bossDead:bDead}; } saveData={money:money,missionIdx:missionIdx,health:health,x:sx,z:sz,weapons:ownedWeapons,ammo:ammo,cars:ownedCars,outfits:ownedOutfits,outfit:currentOutfit,weaponIdx:weaponIdx,medkits:medkits,carState:carState,autoAim:autoAim,sideDone:(typeof side!=="undefined"?side.done:null),clockT:(typeof clockT==="number"?clockT:17.66),radioIdx:radioIdx,settings:(typeof captureSettings==="function"?captureSettings():null),m5:m5}; hasSave=true; try{ localStorage.setItem(SAVE_KEY,JSON.stringify(saveData)); }catch(e){} refreshContinueBtn(); } /* TAHAP 5 (lanjutan): save kini JUGA menyimpan jam dalam game (clockT), stasiun radio (radioIdx), seluruh pengaturan (settings), dan progres Misi 5 (m5: jumlah anak buah Azura yang sudah tumbang, status & HP bos) */
function loadSave(){ try{ var raw=localStorage.getItem(SAVE_KEY); if(!raw) return; var d=JSON.parse(raw); if(d&&typeof d.money==="number"&&typeof d.missionIdx==="number"){ saveData=d; hasSave=true; if(typeof d.autoAim==="boolean"){ autoAim=d.autoAim; var sa=document.getElementById("setAutoAim"); if(sa) sa.value=autoAim?"on":"off"; } if(d.settings&&typeof applySettings==="function") applySettings(d.settings); if(typeof d.radioIdx==="number"&&d.radioIdx>=0&&d.radioIdx<radios.length) radioIdx=d.radioIdx|0; if(typeof d.clockT==="number"&&d.clockT>=0&&d.clockT<24) clockT=d.clockT; /* TAHAP 5 (lanjutan): pengaturan, stasiun radio & jam dalam game dipulihkan dari save (save lama tanpa field ini tetap aman — nilai default dipakai) */ if(d.sideDone&&typeof side!=="undefined"){ ["kurir","kilat","balap","buru","buronan"].forEach(function(k){ if(typeof d.sideDone[k]==="number") side.done[k]=d.sideDone[k]; }); } /* TAHAP 4: jumlah penyelesaian misi sampingan ikut tersimpan */ refreshContinueBtn(); } }catch(e){} }
/* TAHAP 5 — PAUSE OTOMATIS: tab disembunyikan / aplikasi pindah / layar terkunci (visibilitychange -> hidden)
   langsung menyimpan progres DAN membuka menu Pause, jadi pemain tidak kehilangan kendali atau tertabrak
   saat kembali. Bila sudah pause (toko/peta/fail/tamat/dialog/tutorial terbuka) cukup simpan saja. */
document.addEventListener("visibilitychange",function(){ if(document.hidden&&gameStarted){ persistSave(); if(!paused&&!failShowing&&!gameFinished&&!dialogueActive) pauseGame(); } });
addEventListener("pagehide",function(){ if(gameStarted) persistSave(); });
addEventListener("beforeunload",function(){ if(gameStarted) persistSave(); });
/* TAHAP 5 — TUTORIAL MISI 1: 5 langkah kontrol singkat, tampil SEKALI di awal NEW GAME (misi 1).
   ROUND 10: bukan lagi modal layar penuh yang mem-pause game — kini KARTU KECIL di bawah layar
   (tidak menutupi kota), pemain TETAP BISA BERGERAK saat kartu tampil. Langkah MAJU OTOMATIS saat
   pemain melakukan aksinya (bergerak / putar kamera / masuk mobil / menyerang); tombol LANJUT &
   LEWATI tetap ada untuk yang mau melangkah manual. Esc tetap melewati tutorial. */
var TUT_STEPS=[
 {i:"🕹️",t:"1. Bergerak",x:"Di HP pakai <b>joystick kiri</b>. Di PC pakai <b>WASD / tombol panah</b>. Tombol <b>LARI</b> di HP atau <b>Shift</b> di PC untuk berlari lebih cepat."},
 {i:"📷",t:"2. Putar Kamera",x:"<b>Seret sisi kanan layar</b> untuk memutar kamera 360°. Seret ke atas untuk menengadah ke langit — ada <b>helikopter</b> terbang di atas kota!"},
 {i:"🚗",t:"3. Masuk & Nyetir Mobil",x:"Dekati mobil lalu tekan tombol <b>MASUK</b> (PC: <b>E</b>). Di dalam mobil: <b>A / W</b> gas, tombol <b>MUNDUR</b> untuk mundur, dan <b>E</b> lagi untuk keluar (mobil harus berhenti dulu)."},
 {i:"👊",t:"4. Serang & Ganti Senjata",x:"Tombol <b>PUKUL / TEMBAK</b> di HP atau <b>F</b> di PC untuk menyerang ke arah hadapmu. Ganti senjata yang kamu miliki dengan tombol senjata atau <b>Q</b>."},
 {i:"🗺️",t:"5. Selesaikan Misinya!",x:"Ikuti <b>penanda merah</b> dan minimap: ambil <b>paket di dermaga</b> untuk menyelesaikan Misi 1. <b>M</b> membuka peta, <b>Esc</b> pause. Selamat bermain, Rico!"}
];
var tutIdx=0, tutActive=false, tutStepAt=0, tutYaw0=0, tutDidAttack=false;
function renderTutStep(){ var s=TUT_STEPS[tutIdx]; document.getElementById("tutStepLabel").textContent="Tutorial — Langkah "+(tutIdx+1)+" dari "+TUT_STEPS.length; document.getElementById("tutIcon").textContent=s.i; document.getElementById("tutTitle").textContent=s.t; document.getElementById("tutText").innerHTML=s.x; document.getElementById("btnTutNext").textContent= tutIdx>=TUT_STEPS.length-1? "SIAP, GAS! 🚀" : "LANJUT ▶"; var dots=""; for(var i=0;i<TUT_STEPS.length;i++) dots+= i===tutIdx?"●":"○"; document.getElementById("tutDots").textContent=dots; tutStepAt=performance.now(); if(tutIdx===1) tutYaw0=camYaw; if(tutIdx===3) tutDidAttack=false; }
function showTutorial(){ tutIdx=0; tutActive=true; renderTutStep(); document.getElementById("tutCard").classList.add("on"); }
function endTutorial(){ var m=document.getElementById("tutCard"); if(m) m.classList.remove("on"); tutActive=false; }
function tutNext(){ initAudio(); if(tutIdx>=TUT_STEPS.length-1){ endTutorial(); toast("🎓 Tutorial selesai — ambil paket di dermaga!"); return; } tutIdx++; renderTutStep(); if(AC) beep(620,.07,"sine",.1); }
function tutAutoCheck(now){ if(!tutActive||!gameStarted||paused) return; if(missionIdx!==0){ endTutorial(); return; } if(now-tutStepAt<1200) return; /* beri waktu baca 1,2 detik sebelum auto-maju */ var adv=false;
 if(tutIdx===0){ if(joy.x||joy.y||keys["KeyW"]||keys["KeyA"]||keys["KeyS"]||keys["KeyD"]||keys["ArrowUp"]||keys["ArrowDown"]||keys["ArrowLeft"]||keys["ArrowRight"]) adv=true; } /* langkah 1: pemain sudah bergerak */
 else if(tutIdx===1){ if(Math.abs(camYaw-tutYaw0)>0.3) adv=true; } /* langkah 2: kamera sudah diputar */
 else if(tutIdx===2){ if(inCar) adv=true; } /* langkah 3: pemain sudah masuk mobil */
 else if(tutIdx===3){ if(tutDidAttack) adv=true; } /* langkah 4: pemain sudah menyerang */
 if(adv) tutNext(); }
document.getElementById("btnTutNext").onclick=function(){ tutNext(); };
document.getElementById("btnTutSkip").onclick=function(){ initAudio(); endTutorial(); };
function startGame(cont){ initAudio(); closeModals(); gameStartAt=performance.now(); perfPromptOpen=false; hidePerfBanner(); /* ROUND 10: sesi baru — jam mulai 30 detik bebas tawaran performa, banner lama disembunyikan */ gameFinished=false; failShowing=false; inHouse=null; hasPackage=false; missionTimer=null; hideDialog(true); hideHint(); cancelSideMission(true); /* TAHAP 4: misi sampingan yang sedang berjalan tidak dibawa lintas sesi/mode */ joy.x=0; joy.y=0; joy.id=null; look.id=null; if(cont&&saveData){ money=saveData.money; missionIdx=Math.min(saveData.missionIdx,missions.length); health=(typeof saveData.health==="number"&&saveData.health>0)?saveData.health:100; wanted=0; applySavedShop(); /* TAHAP 5 (lanjutan): pulihkan jam dalam game, stasiun radio & pengaturan dari save; siapkan pemulihan progres Misi 5 (diterapkan spawnAzura saat setMission berjalan) */ if(typeof saveData.clockT==="number"&&saveData.clockT>=0&&saveData.clockT<24) clockT=saveData.clockT; if(typeof saveData.radioIdx==="number"&&saveData.radioIdx>=0&&saveData.radioIdx<radios.length) radioIdx=saveData.radioIdx|0; if(saveData.settings&&typeof applySettings==="function") applySettings(saveData.settings); m5Restore= (saveData.missionIdx===4&&saveData.m5)? saveData.m5 : null; restoredM5Down= (m5Restore&&typeof m5Restore.down==="number")? m5Restore.down : 0; if(saveData.sideDone){ ["kurir","kilat","balap","buru","buronan"].forEach(function(k){ if(typeof saveData.sideDone[k]==="number") side.done[k]=saveData.sideDone[k]; }); } /* pulihkan inventaris toko: senjata, amunisi, mobil garasi, pakaian */ /* pulihkan POSISI tersimpan; bila titiknya kini tertutup collider, jatuh ke spawn aman */
   if(typeof saveData.x==="number"&&typeof saveData.z==="number"&&!collide(saveData.x,saveData.z)) player.position.set(saveData.x,0,saveData.z); else player.position.set(0,0,70); camYaw=0; camPitch=0.15; } else { money=250; missionIdx=0; wanted=0; health=100; player.position.set(0,0,70); playerAngle=Math.PI; player.rotation.y=Math.PI; camYaw=0; camPitch=0.15; resetShopState(); side.done={kurir:0,kilat:0,balap:0,buru:0,buronan:0}; m5Restore=null; restoredM5Down=0; clockT=11.5; /* NEW GAME / MAIN LAGI: progres penuh direset, termasuk hitungan misi sampingan; jam kembali ke SIANG 11:30 (SPEC 12:33: New Game mulai 11:00-12:00, kesan awal biru cerah; sore/malam tetap datang saat jam berjalan), sedangkan stasiun radio & pengaturan dipertahankan sebagai preferensi pemain */ }
 gameStarted=true; paused=false; hideDebugOverlay(); document.getElementById("menu").style.display="none"; document.getElementById("hud").classList.add("on"); document.getElementById("touch").classList.add("on"); setMission(); drawMap(document.getElementById("minimap"),.82); centerMsg("KOTA SEJA"); toast("📻 "+radios[radioIdx]); updateAB(); refreshWeaponUI(); persistSave(); r9SnapCamera(); /* ROUND 10: kamera langsung SNAP ke posisi akhirnya (sejajar, menghadap jalan) — tidak lagi meluncur turun dari orbit menu di 1-2 detik pertama */ /* NEW GAME menimpa save lama; CONTINUE menyegarkan cap posisi */ if(cont&&missionIdx===4&&restoredM5Down>0){ var rd5=restoredM5Down; setTimeout(function(){ toast("▶ Lanjut Misi 5: "+rd5+" dari 6 anak buah Azura SUDAH tumbang — progres pertempuran tersimpan, misi TIDAK diulang dari awal."); },2400); } if(!cont&&missionIdx===0) showTutorial(); /* TAHAP 5: tutorial 5 langkah hanya di awal NEW GAME misi 1 */ }
function findSafeNear(x,z){ if(!collide(x,z)) return {x:x,z:z}; var radii=[4,7,10,13,16]; for(var ri=0;ri<radii.length;ri++){ for(var ai=0;ai<8;ai++){ var a=ai*Math.PI/4, nx=x+Math.sin(a)*radii[ri], nz=z+Math.cos(a)*radii[ri]; if(!collide(nx,nz)) return {x:nx,z:nz}; } } return {x:0,z:70}; }
function clearMissionObjects(){ if(pkgMesh){ scene.remove(pkgMesh); pkgMesh=null; pkgPos=null; } if(informantMesh){ scene.remove(informantMesh); informantMesh=null; informantPos=null; } azura.forEach(function(e){ scene.remove(e.mesh); }); azura=[]; bossActive=false; if(typeof drops!=="undefined"){ drops.forEach(function(dr){ scene.remove(dr.mesh); }); drops.length=0; } if(typeof warnSprite!=="undefined"&&warnSprite) warnSprite.visible=false; if(typeof aimRing!=="undefined"&&aimRing) aimRing.visible=false; aimTarget=null; }
function spawnPackage(){ var m=missions[0]; pkgPos=findSafeNear(m.x,m.z); var g=new THREE.Group(); var box=new THREE.Mesh(new THREE.BoxGeometry(.95,.65,.95),new THREE.MeshLambertMaterial({color:0xc68a3a})); box.position.y=.35; box.castShadow=true; g.add(box); var tape=new THREE.Mesh(new THREE.BoxGeometry(1,.68,.22),new THREE.MeshBasicMaterial({color:0xffd166})); tape.position.y=.35; g.add(tape); var tape2=new THREE.Mesh(new THREE.BoxGeometry(.22,.68,1),new THREE.MeshBasicMaterial({color:0xffd166})); tape2.position.y=.35; g.add(tape2); g.position.set(pkgPos.x,0,pkgPos.z); scene.add(g); pkgMesh=g; }
function spawnInformant(){ var m=missions[3]; informantPos=findSafeNear(m.x,m.z); informantMesh=makePerson(0x7b2ff7,0xd9a066,{hair:0x241335,hairStyle:"hood",hood:0x7b2ff7,top:"jacket",pants:0x2c2140}); /* INFORMAN: jaket ungu + tudung ungu */ informantMesh.position.set(informantPos.x,0,informantPos.z); informantMesh.rotation.y=Math.PI; scene.add(informantMesh); }
function spawnAzura(){ var m=missions[4]; var offs=[[0,0],[5,3],[-5,2],[3,-5],[-3,-5],[7,-2],[-7,-3]]; for(var i=0;i<6;i++){ var sp=findSafeNear(m.x+offs[i][0],m.z+offs[i][1]); var mesh=makePerson(0x232a35,[0xf2c79b,0xe8b08a,0xd9a066,0xb97a4e,0x8a5a33][i%5],{top:"suit",pants:0x14161c,glasses:0x0a0b0d,emblem:0xffc233,face:"stern",hair:0x0f0c09}); mesh.position.set(sp.x,0,sp.z); scene.add(mesh); var roleI=(i%3===1)?"gun":"melee"; setHandProp(mesh,roleI==="gun"?"gun":"knife"); azura.push({mesh:mesh,hp:36,maxHp:36,isBoss:false,alive:true,atkCd:0,role:roleI,shootCd:1+Math.random()*1.2,kx:0,kz:0,carHitT:0}); } var bp=findSafeNear(m.x+offs[6][0],m.z+offs[6][1]-4); var boss=makePerson(0xb00020,0xe8b08a,{top:"suit",pants:0x2a0d12,necklace:0xffc233,face:"scar",hair:0x0f0c09,hairStyle:"short"}); /* BOS: jas merah tua + kalung emas + bekas luka di wajah (scale 1.3 tetap di baris berikut) */ boss.scale.set(1.3,1.3,1.3); boss.position.set(bp.x,0,bp.z); scene.add(boss); azura.push({mesh:boss,hp:120,maxHp:120,isBoss:true,alive:true,atkCd:0,shootCd:1.2,shots:0,reloadT:0,warnT:0,strafeT:0,strafeDir:1,kx:0,kz:0,carHitT:0}); if(m5Restore){ var dnR=Math.max(0,Math.min(6,m5Restore.down|0)); for(var ri2=0;ri2<dnR;ri2++){ var e2=azura[ri2]; if(e2&&!e2.isBoss&&e2.alive){ e2.alive=false; e2.hp=0; e2.mesh.rotation.x=Math.PI/2; e2.mesh.position.y=.25; } } var bE=azura[azura.length-1]; if(bE&&bE.isBoss){ if(m5Restore.bossDead){ bE.alive=false; bE.hp=0; bE.mesh.rotation.x=Math.PI/2; bE.mesh.position.y=.25; setTimeout(function(){ if(missionIdx===4) completeMission(); },700); } else if(typeof m5Restore.bossHp==="number"&&m5Restore.bossHp>0&&m5Restore.bossHp<120) bE.hp=m5Restore.bossHp; } if(dnR>=6||m5Restore.bossActive) bossActive=true; m5Restore=null; } } /* TAHAP 5 (lanjutan): CONTINUE di tengah Misi 5 — anak buah yang sudah tumbang DIPULIHKAN sebagai tumbang (rebah, HP 0), HP bos & status bos aktif ikut dipulihkan; m5Restore hanya diisi jalur Continue, jadi ULANGI MISI dari checkpoint tetap mulai Misi 5 dari awal seperti sebelumnya */ /* TAHAP 2: 6 anak buah (2 penembak "gun" menjaga jarak, 4 jarak dekat "melee") + bos dengan state tembak/reload/strafe */
function azuraLeft(){ var n=0; azura.forEach(function(e){ if(e.alive&&!e.isBoss) n++; }); return n; }
function damageAzura(e,dmg){ e.hp-=dmg; if(e.hp<=0){ e.alive=false; e.mesh.rotation.x=Math.PI/2; e.mesh.position.y=.25; if(AC) beep(140,.3,"sawtooth",.2); if(e.isBoss){ if(warnSprite) warnSprite.visible=false; spawnDrop(e.mesh.position.x,e.mesh.position.z,true); centerMsg("💥 BOS AZURA TUMBANG!"); setTimeout(function(){ var mm=missions[missionIdx]; if(mm&&missionIdx===4) completeMission(); },700); } else { spawnDrop(e.mesh.position.x,e.mesh.position.z,false); var left=azuraLeft(); toast("☠️ Anggota Azura tumbang! Sisa: "+left); if(left===0){ bossActive=true; centerMsg("⚠️ BOS AZURA TURUN TANGAN!"); toast("Bos Azura menyerang — kalahkan dia!"); } refreshMissionText(); } } else { toast((e.isBoss?"👹 Bos Azura":"🥷 Azura")+" HP: "+Math.max(0,Math.ceil(e.hp))); } }
function refreshMissionText(){ if(missionIdx===4){ var el=document.getElementById("missionText"); if(el) el.textContent= bossActive? "BOS AZURA sudah turun tangan — kalahkan bos untuk menamatkan misi!" : ("Di pelabuhan: kalahkan anggota Azura (sisa "+azuraLeft()+" dari 6), lalu hadapi BOS Azura."); } }
function setMission(){ var m=missions[missionIdx]; clearMissionObjects(); missionTimer=null; hideHint(); hideDialog(true); if(!m){ document.querySelector("#missionBox b").textContent="SELESAI"; document.getElementById("missionText").textContent="Semua misi utama selesai! Jelajahi kota bebas — misi sampingan tetap tersedia lewat tombol 🎯."; marker.visible=false; updateMissionTimerUI(); return; } document.querySelector("#missionBox b").textContent="BAB "+(missionIdx+1)+" — "+m.t; /* ROUND 10: misi utama bernama BAB di kotak misi (contoh "BAB 1 — SAMBUTAN HANGAT") */ document.getElementById("missionText").textContent=m.d; marker.visible=true; marker.position.set(m.x,9,m.z);
 if(missionIdx===0){ hasPackage=false; spawnPackage(); if(pkgPos) marker.position.set(pkgPos.x,9,pkgPos.z); }
 else if(missionIdx===1){ hasPackage=true; missionTimer=90; }
 else if(missionIdx===2){ wanted=3; toast("⭐⭐⭐ Wanted 3 bintang! Kabur!"); }
 else if(missionIdx===3){ spawnInformant(); if(informantPos) marker.position.set(informantPos.x,9,informantPos.z); }
 else if(missionIdx===4){ wanted=0; spawnAzura(); refreshMissionText(); }
 updateMissionTimerUI(); }
function completeMission(){ var m=missions[missionIdx]; if(!m) return; money+=m.r; missionIdx++; updateHUD(); persistSave(); if(missionIdx>=missions.length){ setMission(); showEnding(); return; } setMission(); centerMsg("MISI SELESAI +$"+m.r); }
function pickupPackage(){ if(missionIdx!==0||!pkgMesh) return; hasPackage=true; toast("📦 Paket diambil! Antar ke tujuan berikutnya."); if(AC) beep(660,.15,"sine",.18); if(navigator.vibrate) navigator.vibrate(60); completeMission(); }
function showHint(txt){ var h=document.getElementById("missionHint"); if(!h) return; if(txt){ h.textContent=txt; h.classList.add("on"); } else h.classList.remove("on"); }
function hideHint(){ showHint(""); }
function updateMissionTimerUI(){ var t=document.getElementById("missionTimer"); if(!t) return; if(missionTimer===null){ t.classList.remove("on"); t.textContent=""; return; } t.classList.add("on"); var sec=Math.max(0,Math.ceil(missionTimer)); var mm=Math.floor(sec/60), ss=sec%60; t.textContent="⏱️ Sisa waktu: "+mm+":"+(ss<10?"0":"")+ss; t.classList.toggle("low",sec<=15); }
function showFail(reason){ if(failShowing) return; failShowing=true; missionTimer=null; cancelSideMission(true); /* TAHAP 4: gagal misi utama membatalkan misi sampingan yang sedang berjalan */ document.getElementById("failText").textContent=reason; paused=true; document.querySelectorAll(".modal").forEach(function(x){ x.classList.remove("on"); }); document.getElementById("modalFail").classList.add("on"); persistSave(); }
function restartCurrentMission(){ failShowing=false; document.querySelectorAll(".modal").forEach(function(x){ x.classList.remove("on"); }); paused=false; health=100; if(inCar){ inCar=null; player.visible=true; headlight.intensity=0; carSpeed=0; } wanted=0; setMission(); updateHUD(); persistSave(); centerMsg("CHECKPOINT — ULANGI MISI "+(missionIdx+1)); }
function onPlayerDown(reason){ if(failShowing||dialogueActive) return; health=100; wanted=0; inHouse=null; if(inCar){ inCar=null; player.visible=true; headlight.intensity=0; carSpeed=0; updateAB(); } player.position.set(0,0,70); showFail(reason); }
function showEnding(){ gameFinished=true; wanted=0; missionTimer=null; hideHint(); hidePerfBanner(); perfPromptOpen=false; var es=document.getElementById("endStats"); if(es) es.innerHTML="💰 Uang akhir: <b>$"+money+"</b> • 🔫 Senjata: <b>"+weapons[weaponIdx]+"</b><br>Terima kasih sudah memainkan Kota Seja 3D — Halcyon Edition!"; paused=true; document.getElementById("modalEnding").classList.add("on"); persistSave(); centerMsg("🏆 TAMAT!"); }
function hideDialog(silent){ dialogueActive=false; dialogueIdx=0; var d=document.getElementById("dialogBox"); if(d) d.classList.remove("on"); if(!silent) paused=false; }
function startDialogue(){ dialogueActive=true; dialogueIdx=0; paused=true; var d=document.getElementById("dialogBox"); d.classList.add("on"); document.getElementById("dialogName").textContent=DIALOG_M4[0][0]; document.getElementById("dialogText").textContent=DIALOG_M4[0][1]; marker.visible=false; }
function nextDialogue(){ dialogueIdx++; if(dialogueIdx>=DIALOG_M4.length){ hideDialog(); toast("📍 Lokasi markas Azura diketahui: PELABUHAN!"); completeMission(); return; } document.getElementById("dialogName").textContent=DIALOG_M4[dialogueIdx][0]; document.getElementById("dialogText").textContent=DIALOG_M4[dialogueIdx][1]; if(AC) beep(520,.07,"sine",.1); }
/* ============ TAHAP 2 — AI MUSUH & BOS AZURA (diperbarui) ============
   - Musuh MENYERANG PEMAIN DI DALAM MOBIL: penembak & bos menembak mobil (damage masuk ke health mobil;
     mobil meledak -> pemain terlempar & kena damage lewat explodeCar), petarung jarak dekat memukul mobil.
   - MOBIL PEMAIN MENABRAK MUSUH: damage sebanding kecepatan + efek terpental (knockback e.kx/e.kz).
   - STEERING sederhana anti-nyangkut di moveFoe(): coba lurus -> geser per sumbu -> geser menyamping tegak lurus.
   - BOS: tembakan terhalang gedung (losClear, sama seperti polisi), damage 5–9 & jeda 1,1–2,0 dtk bervariasi,
     RELOAD 2,2 dtk tiap 4 tembakan, STRAFE menyamping saat menembak, dan PERINGATAN 0,45 dtk (kilat merah
     berdenyut di atas bos + bunyi bip ganda) sebelum setiap tembakan.
   - ANAK BUAH: peran "gun" menjaga jarak 9–17 & menembak (garis pandang dicek), peran "melee" mengejar &
     memukul; HP <= 35% -> MUNDUR menjauhi pemain (penembak tetap menembak sambil mundur).
   - DROP: anak buah tumbang ~60% menjatuhkan uang / amunisi kecil; bos selalu menjatuhkan uang besar. */
function moveFoe(e,vx,vz,dt){ var mp=e.mesh.position, mx=vx*dt, mz=vz*dt;
 if(!collide(mp.x+mx,mp.z+mz)){ mp.x+=mx; mp.z+=mz; return; }
 if(!collide(mp.x+mx,mp.z)){ mp.x+=mx; return; }
 if(!collide(mp.x,mp.z+mz)){ mp.z+=mz; return; }
 var sp=Math.hypot(vx,vz); if(sp<.1) return; var sx=-vz/sp*sp*dt, sz=vx/sp*sp*dt; /* mentok depan: geser menyamping */
 if(!collide(mp.x+sx,mp.z+sz)){ mp.x+=sx; mp.z+=sz; return; }
 if(!collide(mp.x-sx,mp.z-sz)){ mp.x-=sx; mp.z-=sz; } }
function foeShoot(e,dmg){ var fp=e.mesh.position; fireTracer(fp.x,1.55,fp.z, player.position.x,1.1,player.position.z, 0xff6644); muzzleFlash(fp.x+Math.sin(e.mesh.rotation.y)*.9,1.55,fp.z+Math.cos(e.mesh.rotation.y)*.9); gunSound("Pistol",.4);
 if(inCar){ damageCar(inCar,dmg); if(inCar&&!inCar.userData.burnt) toast("🔫 Mobilmu ditembaki Azura! Health mobil: "+Math.max(0,Math.round(inCar.userData.hp))+"%"); return; }
 health-=dmg; if(navigator.vibrate) navigator.vibrate(40); toast((e.isBoss?"👹 Bos Azura":"🥷 Azura")+" menembakmu! ❤️ "+Math.max(0,Math.round(health))+"%"); updateHUD();
 if(health<=0) onPlayerDown("Kamu tumbang oleh tembakan Azura. Misi 5 diulang dari checkpoint — habisi anak buahnya dulu, dan berlindung di balik gedung: tembakan mereka terhalang bangunan."); }
function bossAI(e,dt,dx,dz,d){ var mp=e.mesh.position; var dirx=dx/(d||1), dirz=dz/(d||1);
 e.strafeT-=dt; if(e.strafeT<=0){ e.strafeT=1+Math.random()*.7; e.strafeDir= Math.random()<.5?1:-1; }
 if(e.reloadT>0){ e.reloadT-=dt; moveFoe(e,dirx*2.4,dirz*2.4,dt); e.mesh.userData.walk+=dt*2.4*2.2; poseWalk(e.mesh,1); return; } /* reload: terus mendekat, tidak menembak */
 if(e.warnT>0){ e.warnT-=dt; warnSprite.visible=true; warnSprite.position.set(mp.x,3.7,mp.z); var ws=1.1+Math.sin(performance.now()*.05)*.4; warnSprite.scale.set(ws,ws,1);
  if(e.warnT<=0){ warnSprite.visible=false; if(d<30&&losClear(mp.x,mp.z,player.position.x,player.position.z)) foeShoot(e,5+Math.floor(Math.random()*5)); e.shots++; if(e.shots>=4){ e.shots=0; e.reloadT=2.2; toast("🔄 Bos Azura mengisi ulang peluru — kesempatan menyerang!"); } e.shootCd=1.1+Math.random()*.9; }
  return; }
 if(d<=2.9){ e.atkCd-=dt; if(e.atkCd<=0){ e.atkCd=.9; if(inCar){ damageCar(inCar,8); toast("👹 Bos Azura menghantam mobilmu!"); if(AC) beep(150,.12,"square",.15); } else { health-=12; if(AC) beep(160,.15,"square",.18); if(navigator.vibrate) navigator.vibrate(40); toast("👹 Bos Azura memukulmu! ❤️ "+Math.max(0,Math.round(health))+"%"); updateHUD(); if(health<=0) onPlayerDown("Kamu tumbang oleh Bos Azura. Misi 5 diulang dari checkpoint — habisi anak buahnya dulu, dekati bos sambil terus bergerak."); } } return; }
 if(d<27&&losClear(mp.x,mp.z,player.position.x,player.position.z)){ moveFoe(e,-dirz*e.strafeDir*2.1,dirx*e.strafeDir*2.1,dt); e.mesh.userData.walk+=dt*2.1*2.2; poseWalk(e.mesh,1); /* strafe menyamping saat menembak */
  e.shootCd-=dt; if(e.shootCd<=0){ e.warnT=.45; if(AC){ beep(1250,.07,"square",.13); setTimeout(function(){ if(AC) beep(1250,.07,"square",.13); },140); } } return; }
 moveFoe(e,dirx*3.7,dirz*3.7,dt); e.mesh.userData.walk+=dt*3.7*2.2; poseWalk(e.mesh,1); } /* di luar jangkauan / terhalang gedung: kejar */
function updateAzura(dt){ if(missionIdx!==4) return; azura.forEach(function(e){ if(!e.alive) return; var mp=e.mesh.position;
 if(e.kx||e.kz){ var kx2=e.kx*dt, kz2=e.kz*dt; if(!collide(mp.x+kx2,mp.z)) mp.x+=kx2; if(!collide(mp.x,mp.z+kz2)) mp.z+=kz2; var kd=Math.pow(.001,dt); e.kx*=kd; e.kz*=kd; if(Math.abs(e.kx)<.1)e.kx=0; if(Math.abs(e.kz)<.1)e.kz=0; } /* terpental: geser sambil mereda */
 if(e.isBoss&&!bossActive){ e.mesh.rotation.y+=dt*.4; return; }
 var dx=player.position.x-mp.x, dz=player.position.z-mp.z, d=Math.hypot(dx,dz); /* player.position mengikuti mobil saat inCar */
 if(inCar){ e.carHitT-=dt; if(d<2.7&&Math.abs(carSpeed)>4&&e.carHitT<=0){ e.carHitT=.6; var rd=Math.min(48,Math.round(Math.abs(carSpeed)*2.3)); e.kx=Math.sin(inCar.userData.angle)*Math.abs(carSpeed)*1.1; e.kz=Math.cos(inCar.userData.angle)*Math.abs(carSpeed)*1.1; damageAzura(e,rd); toast("🚗💥 Kamu menabrak Azura! (-"+rd+" HP)"); sfxCrash(.7); if(navigator.vibrate) navigator.vibrate(70); if(!e.alive) return; } } /* TABRAK LARI: damage ∝ kecepatan mobil */
 if(d>48) return;
 e.mesh.rotation.y=Math.atan2(dx,dz);
 if(e.isBoss){ bossAI(e,dt,dx,dz,d); return; }
 var dirx=dx/(d||1), dirz=dz/(d||1), lowHp= e.hp<=(e.maxHp||36)*.35;
 if(e.role==="gun"){ e.shootCd-=dt; var want= lowHp? -1 : (d>17? 1 : (d<9? -1 : 0));
  if(want!==0){ moveFoe(e,dirx*want*3.1,dirz*want*3.1,dt); e.mesh.userData.walk+=dt*3.1*2.2; poseWalk(e.mesh,1); }
  if(e.shootCd<=0){ e.shootCd=1.5+Math.random()*1.1; if(d<26&&losClear(mp.x,mp.z,player.position.x,player.position.z)) foeShoot(e, inCar?6:4); }
  return; }
 var meleeR= inCar? 3.4 : 2.3;
 if(lowHp&&d<20){ moveFoe(e,-dirx*3.2,-dirz*3.2,dt); e.mesh.userData.walk+=dt*3.2*2.2; poseWalk(e.mesh,1); return; } /* HP rendah: mundur cari perlindungan */
 if(d>meleeR){ moveFoe(e,dirx*3.0,dirz*3.0,dt); e.mesh.userData.walk+=dt*3.0*2.2; poseWalk(e.mesh,1); }
 else { e.atkCd-=dt; if(e.atkCd<=0){ e.atkCd=.9; if(inCar){ damageCar(inCar,4); toast("🥷 Azura memukul mobilmu!"); if(AC) beep(150,.12,"square",.15); } else { health-=7; if(AC) beep(160,.15,"square",.18); if(navigator.vibrate) navigator.vibrate(40); toast("🥷 Azura memukulmu! ❤️ "+Math.max(0,Math.round(health))+"%"); updateHUD(); if(health<=0) onPlayerDown("Kamu tumbang melawan sindikat Azura di pelabuhan. Misi 5 diulang dari checkpoint — kalahkan anak buahnya dulu, baru bosnya."); } } } }); }
/* DROP MUSUH — uang / amunisi kecil di titik musuh tumbang; diambil dengan berjalan melewatinya, hilang setelah 30 detik */
var drops=[];
function makeAmmoMesh(){ var g=new THREE.Group(); var b=new THREE.Mesh(new THREE.BoxGeometry(.5,.3,.38),new THREE.MeshLambertMaterial({color:0x3f6212})); b.position.y=.15; g.add(b); var t=new THREE.Mesh(new THREE.BoxGeometry(.52,.1,.4),new THREE.MeshBasicMaterial({color:0xffd166})); t.position.y=.32; g.add(t); return g; }
function spawnDrop(x,z,big){ var kind=null; if(big) kind="cash"; else { var r=Math.random(); if(r<.34) kind="cash"; else if(r<.6) kind="ammo"; } if(!kind) return; var sp=findSafeNear(x,z); var mesh= kind==="cash"? makeCashMesh() : makeAmmoMesh(); mesh.position.set(sp.x,0,sp.z); scene.add(mesh); drops.push({kind:kind,mesh:mesh,x:sp.x,z:sp.z,born:performance.now(),big:!!big}); }
function updateDrops(dt,now){ var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z;
 for(var i=drops.length-1;i>=0;i--){ var dr=drops[i]; dr.mesh.rotation.y+=dt*1.6; dr.mesh.position.y=.12+Math.sin(now*.004+i*1.7)*.1; var gone=false;
  if(now-dr.born>30000) gone=true;
  else if(Math.hypot(px-dr.x,pz-dr.z)<2.2){ if(dr.kind==="cash"){ var amt= dr.big? 120 : 25+Math.floor(Math.random()*31); money+=amt; toast("💵 Drop Azura: +$"+amt); if(AC) beep(990,.12,"sine",.16); }
   else { var og=[]; for(var wi=0;wi<weapons.length;wi++) if(ownedWeapons[wi]&&isGun(weapons[wi])) og.push(weapons[wi]);
    if(og.length){ var gw=og[Math.floor(Math.random()*og.length)], n= gw==="SMG"?15:(gw==="Shotgun"?4:8); ammo[gw]=(ammo[gw]||0)+n; toast("🎯 Drop amunisi: +"+n+" peluru "+gw); } else { money+=30; toast("💵 Drop Azura: +$30"); }
    if(AC) beep(880,.1,"sine",.14); refreshWeaponUI(); }
   updateHUD(); persistSave(); gone=true; }
  if(gone){ scene.remove(dr.mesh); drops.splice(i,1); } } }
function checkMission(dt,now){ var m=missions[missionIdx]; if(!m||failShowing||dialogueActive) { if(pkgMesh) pkgMesh.rotation.y+=dt*1.4; return; } var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z;
 if(missionIdx===0){ if(pkgMesh){ pkgMesh.rotation.y+=dt*1.4; pkgMesh.position.y=.12+Math.sin(now*.004)*.12; if(Math.hypot(px-pkgMesh.position.x,pz-pkgMesh.position.z)<2.3&&!inCar) pickupPackage(); else if(Math.hypot(px-pkgMesh.position.x,pz-pkgMesh.position.z)<4.5&&!inCar) showHint("Tekan B (atau tombol MASUK/PUKUL) untuk mengambil paket 📦"); else hideHint(); } return; }
 if(missionIdx===1){ if(missionTimer!==null){ missionTimer-=dt; updateMissionTimerUI(); if(missionTimer<=0){ showFail("⏱️ Waktu habis! Paket harus diantar NAIK MOBIL ke Neon Strip sebelum timer selesai. Misi 2 diulang dari checkpoint — paket tetap di tanganmu."); return; } } var d1=Math.hypot(px-m.x,pz-m.z); if(!inCar){ showHint(d1<7? "Butuh kendaraan — kamu sudah di tujuan, tapi paket WAJIB diantar naik mobil! Masuk mobil lalu kembali ke penanda." : "Butuh kendaraan — paket ini hanya bisa diantar naik mobil. Masuk mobil terdekat!"); } else hideHint(); if(inCar&&d1<6.5){ hideHint(); missionTimer=null; updateMissionTimerUI(); completeMission(); } return; }
 if(missionIdx===2){ var d2=Math.hypot(px-m.x,pz-m.z); /* TAHAP 4: misi ini TIDAK lagi meluruhkan wanted sendiri — wanted hanya turun lewat aturan umum di updateWanted (polisi kehilangan jejak: jauh + tak terlihat > 6 detik, atau pemain ganti mobil). Peluruhan khusus misi versi lama (dt*.18 bila tak ada polisi < 28) menabrak aturan itu. */ if(d2<8){ if(wanted<0.05){ wanted=0; hideHint(); completeMission(); } else showHint("🌳 Sudah di Taman Senja — tapi wanted masih "+Math.ceil(wanted)+"★. Sembunyi sampai polisi kehilangan jejakmu (jauh + tak terlihat), atau ganti mobil!"); } else if(wanted>0) showHint(hiddenT>1.5? "👀 Polisi mulai kehilangan jejakmu… tetap jauh & tak terlihat supaya wanted turun, lalu ke Taman Senja (penanda merah)!" : "⭐ Wanted "+Math.ceil(wanted)+"★ — wanted hanya turun bila polisi kehilangan jejakmu (jauh + tak terlihat beberapa detik) atau kamu ganti mobil. Menuju Taman Senja (penanda merah)."); else hideHint(); return; }
 if(missionIdx===3){ if(informantMesh){ informantMesh.rotation.y=Math.atan2(px-informantMesh.position.x,pz-informantMesh.position.z); idlePose(informantMesh,now); if(Math.hypot(px-informantMesh.position.x,pz-informantMesh.position.z)<3.6&&!inCar) startDialogue(); } return; }
 if(missionIdx===4){ updateAzura(dt); return; } }
/* completeMission lama digantikan versi Tahap 1 di atas */
/* ============ TAHAP 4 — MISI SAMPINGAN (konten tambahan ringan) ============
   Lima misi sampingan yang bisa DIPILIH BEBAS lewat tombol 🎯 (di rel HUD & menu Pause) setelah
   MISI 2 selesai (missionIdx>=2), dan tetap tersedia setelah TAMAT (jelajah bebas). Semuanya bisa
   DIULANG, berhadiah uang, dan targetnya ditandai penanda EMAS di dunia + minimap/peta besar.
   Hanya SATU misi sampingan berjalan pada satu waktu; misi utama tidak terganggu karena timer,
   label & penanda memakai variabel/mesh sendiri (bukan missionTimer/marker misi utama).
   Objek baru dibuat hanya saat misi dimulai (1 paket / 1 target) dan dibuang saat selesai —
   tidak ada objek baru per frame. */
var SIDE_POIS=[{n:"Dermaga",x:-52,z:52},{n:"Neon Strip",x:48,z:42},{n:"Taman Senja",x:-18,z:-54},{n:"Bukit Halcyon",x:52,z:-52},{n:"Marina",x:-52,z:-52},{n:"SPBU Seja",x:-54,z:-80},{n:"Bengkel Seja",x:54,z:80},{n:"Toko Seja",x:10,z:88}];
var SIDE_DEFS={
 kurir:{name:"📦 KURIR CEPAT",reward:180,desc:"Ambil paket di penanda emas, lalu antar ke tujuannya sebelum timer habis. Bonus $1 per detik waktu tersisa (maks +$60)."},
 kilat:{name:"⚡ KURIR KILAT",reward:240,desc:"Kurir versi cepat: ambil paket, lalu antar ke tujuannya dengan TIMER LEBIH SINGKAT. Bonus $1 per detik waktu tersisa (maks +$60)."},
 balap:{name:"🏁 BALAPAN CHECKPOINT",reward:220,desc:"Lewati 4 checkpoint emas NAIK MOBIL sebelum waktu habis. Bonus $1 per detik waktu tersisa (maks +$60)."},
 buru:{name:"🎯 BURU TARGET",reward:200,desc:"Kejar & kalahkan target Azura di penanda emas — pukul, tembak, atau tabrak pakai mobil. Target melawan balik!"},
 buronan:{name:"🚨 BURU BURONAN",reward:260,desc:"Kejar & kalahkan buronan yang KABUR darimu — lebih cepat dan lebih kuat (80 HP). Pukul, tembak, atau tabrak pakai mobil; kalau terpojok dia melawan balik!"}
};
var side={active:false,type:null,phase:0,timer:null,tx:0,tz:0,label:"",steps:null,stepIdx:0,pkgPoi:null,destPoi:null,done:{kurir:0,kilat:0,balap:0,buru:0,buronan:0}};
var sideFoe=null, sidePkg=null;
var sideMarker=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,16,18,1,true),new THREE.MeshBasicMaterial({color:0xffb300,transparent:true,opacity:.5,side:THREE.DoubleSide})); sideMarker.visible=false; scene.add(sideMarker);
function sideUnlocked(){ return missionIdx>=2||gameFinished; }
function sidePoi(exclude){ var p=null, guard=0; do{ p=SIDE_POIS[Math.floor(Math.random()*SIDE_POIS.length)]; guard++; }while(exclude&&p===exclude&&guard<12); return p; }
var _sideTxt="__init__";
function setSideInfo(txt){ if(txt===_sideTxt) return; _sideTxt=txt; var el=document.getElementById("sideInfo"); if(!el) return; if(txt){ el.textContent=txt; el.classList.add("on"); } else { el.textContent=""; el.classList.remove("on"); } }
function fmtSideTime(s){ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+":"+(s%60<10?"0":"")+(s%60); }
function updateSideInfo(){ if(!side.active){ setSideInfo(""); return; } var def=SIDE_DEFS[side.type]; var t=def.name+" — "+side.label; if(side.timer!==null) t+=" • ⏱️ "+fmtSideTime(side.timer); setSideInfo(t); }
function cleanupSideVisuals(){ if(sidePkg){ scene.remove(sidePkg); sidePkg=null; } if(sideFoe){ scene.remove(sideFoe.mesh); sideFoe=null; } sideMarker.visible=false; }
function endSideCleanup(){ side.active=false; side.type=null; side.timer=null; side.steps=null; cleanupSideVisuals(); setSideInfo(""); }
function cancelSideMission(silent){ var was=side.active; endSideCleanup(); if(was&&!silent) toast("🎯 Misi sampingan dibatalkan."); }
function completeSideMission(){ if(!side.active) return; var def=SIDE_DEFS[side.type]; var bonus=0; if(side.timer!==null&&(side.type==="kurir"||side.type==="kilat"||side.type==="balap")) bonus=Math.min(60,Math.floor(side.timer)); var total=def.reward+bonus; money+=total; side.done[side.type]++; var nm=def.name, rw=def.reward; endSideCleanup(); centerMsg("🎯 MISI SAMPINGAN SELESAI +$"+total); toast(nm+" selesai! Hadiah $"+rw+(bonus>0?(" + bonus waktu $"+bonus):"")+" — bisa diulang kapan saja lewat tombol 🎯."); if(AC){ beep(880,.14,"sine",.16); setTimeout(function(){ if(AC) beep(1174,.18,"sine",.16); },130); } if(navigator.vibrate) navigator.vibrate(60); updateHUD(); persistSave(); }
function failSideMission(reason){ if(!side.active) return; endSideCleanup(); centerMsg("🎯 MISI SAMPINGAN GAGAL"); toast(reason); if(AC) beep(196,.25,"square",.16); }
function spawnSidePackage(x,z){ var g=new THREE.Group(); var box=new THREE.Mesh(new THREE.BoxGeometry(.95,.65,.95),new THREE.MeshLambertMaterial({color:0xc68a3a})); box.position.y=.35; box.castShadow=true; g.add(box); var t1=new THREE.Mesh(new THREE.BoxGeometry(1,.68,.22),new THREE.MeshBasicMaterial({color:0xffb300})); t1.position.y=.35; g.add(t1); var sp=findSafeNear(x,z); g.position.set(sp.x,0,sp.z); scene.add(g); return {mesh:g,x:sp.x,z:sp.z}; }
function startSideMission(type){ if(!sideUnlocked()){ toast("🔒 Misi sampingan terbuka setelah MISI 2 selesai."); return; } if(side.active){ toast("🎯 Selesaikan atau batalkan misi sampingan yang sedang berjalan dulu."); return; } if(dialogueActive||failShowing){ toast("🎯 Tidak bisa memulai misi sampingan sekarang."); return; }
 side.active=true; side.type=type; side.phase=0; side.timer=null; side.stepIdx=0;
 if(type==="kurir"||type==="kilat"){ var a=sidePoi(), b=sidePoi(a); var pk=spawnSidePackage(a.x,a.z); sidePkg=pk.mesh; side.pkgPoi=a; var ds=findSafeNear(b.x,b.z); side.destPoi={n:b.n,x:ds.x,z:ds.z}; side.tx=pk.x; side.tz=pk.z; side.label="Ambil paket di "+a.n; toast(SIDE_DEFS[type].name+": ambil paket di "+a.n+" (penanda emas)!"); }
 else if(type==="balap"){ var pool=SIDE_POIS.slice(), steps=[]; for(var i=0;i<4;i++){ var bp=pool.splice(Math.floor(Math.random()*pool.length),1)[0]; var bs=findSafeNear(bp.x,bp.z); steps.push({n:bp.n,x:bs.x,z:bs.z}); } side.steps=steps; side.timer=100; side.tx=steps[0].x; side.tz=steps[0].z; side.label="Checkpoint 1/4: "+steps[0].n; toast("🏁 BALAPAN CHECKPOINT: 4 checkpoint, NAIK MOBIL! Pertama: "+steps[0].n); }
 else if(type==="buru"||type==="buronan"){ var p=sidePoi(); var sp=findSafeNear(p.x,p.z); var isB= type==="buronan"; var mesh= isB? makePerson(0xff6b35,0xd9a066,{top:"jacket",pants:0x2a1a0c,face:"stern",hair:0x0f0c09}) : makePerson(0xd23b2e,0xd9a066,{top:"jacket",pants:0x1c1c22,glasses:0x0a0b0d,face:"stern",hair:0x0f0c09}); mesh.position.set(sp.x,0,sp.z); scene.add(mesh); setHandProp(mesh,"knife"); sideFoe={mesh:mesh,hp:isB?80:60,maxHp:isB?80:60,alive:true,atkCd:0,carHitT:0,kx:0,kz:0,flee:isB}; side.tx=sp.x; side.tz=sp.z; side.label=(isB?"Buru buronan di ":"Buru target di ")+p.n; toast(SIDE_DEFS[type].name+": kalahkan target di "+p.n+" (penanda emas)!"); }
 sideMarker.visible=true; sideMarker.position.set(side.tx,8,side.tz); centerMsg(SIDE_DEFS[type].name); updateSideInfo(); }
function sideDamage(e,dmg){ if(!e||!e.alive) return; e.hp-=dmg; if(e.hp<=0){ e.alive=false; e.mesh.rotation.x=Math.PI/2; e.mesh.position.y=.25; if(AC) beep(140,.3,"sawtooth",.2); centerMsg("🎯 TARGET TUMBANG!"); var foe=e; setTimeout(function(){ if(sideFoe===foe&&side.active&&(side.type==="buru"||side.type==="buronan")) completeSideMission(); },650); } else toast("🎯 Target HP: "+Math.max(0,Math.ceil(e.hp))); }
function updateSide(dt,now){ if(!side.active) return; sideMarker.rotation.y+=dt*.8;
 var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z;
 if(side.type==="kurir"||side.type==="kilat"){
  if(side.phase===0&&sidePkg){ sidePkg.rotation.y+=dt*1.4; var d0=Math.hypot(px-side.tx,pz-side.tz);
   if(d0<2.6&&!inCar){ scene.remove(sidePkg); sidePkg=null; side.phase=1; var dd=Math.hypot(side.destPoi.x-side.tx,side.destPoi.z-side.tz); side.timer= side.type==="kilat"? Math.max(30,Math.round(dd/3)+12) : Math.max(40,Math.round(dd/2.2)+20); /* ROUND 10: KURIR KILAT — timer lebih singkat dari kurir biasa */ side.tx=side.destPoi.x; side.tz=side.destPoi.z; side.label="Antar paket ke "+side.destPoi.n; sideMarker.position.set(side.tx,8,side.tz); toast("📦 Paket diambil! Antar ke "+side.destPoi.n+" sebelum waktu habis!"); if(AC) beep(660,.13,"sine",.16); }
   else side.label= (d0<5&&inCar)? "Turun dari mobil untuk mengambil paket" : "Ambil paket di "+side.pkgPoi.n; }
  else if(side.phase===1){ side.timer-=dt; if(side.timer<=0){ failSideMission("⏱️ Waktu habis — paket kurir tidak terkirim. Coba lagi lewat tombol 🎯."); return; }
   if(Math.hypot(px-side.tx,pz-side.tz)<6.5){ completeSideMission(); return; } } }
 else if(side.type==="balap"){ side.timer-=dt; if(side.timer<=0){ failSideMission("⏱️ Waktu balapan habis di checkpoint "+(side.stepIdx+1)+"/4. Coba lagi lewat tombol 🎯."); return; }
  var st=side.steps[side.stepIdx];
  if(inCar&&Math.hypot(px-st.x,pz-st.z)<6){ if(AC) beep(990,.1,"sine",.15); if(navigator.vibrate) navigator.vibrate(30); side.stepIdx++; if(side.stepIdx>=side.steps.length){ completeSideMission(); return; } side.tx=side.steps[side.stepIdx].x; side.tz=side.steps[side.stepIdx].z; sideMarker.position.set(side.tx,8,side.tz); toast("🏁 Checkpoint "+side.stepIdx+"/4 lolos! Berikutnya: "+side.steps[side.stepIdx].n); }
  side.label= (inCar? "Checkpoint "+(side.stepIdx+1)+"/4: "+st.n : "Naik MOBIL untuk balapan! Checkpoint "+(side.stepIdx+1)+"/4: "+st.n); }
 else if((side.type==="buru"||side.type==="buronan")&&sideFoe){ var mp=sideFoe.mesh.position; side.tx=mp.x; side.tz=mp.z; sideMarker.position.set(mp.x,8,mp.z);
  if(sideFoe.alive){ var dx=player.position.x-mp.x, dz=player.position.z-mp.z, d=Math.hypot(dx,dz);
   if(inCar){ sideFoe.carHitT-=dt; if(d<2.7&&Math.abs(carSpeed)>4&&sideFoe.carHitT<=0){ sideFoe.carHitT=.6; var rd=Math.min(48,Math.round(Math.abs(carSpeed)*2.3)); var kx2=Math.sin(inCar.userData.angle)*2.4, kz2=Math.cos(inCar.userData.angle)*2.4; if(!collide(mp.x+kx2,mp.z+kz2)){ mp.x+=kx2; mp.z+=kz2; } sideDamage(sideFoe,rd); toast("🚗💥 Target tertabrak! (-"+rd+" HP)"); sfxCrash(.7); if(navigator.vibrate) navigator.vibrate(60); if(!sideFoe||!sideFoe.alive){ updateSideInfo(); return; } } }
   if(d<40){ var fl=sideFoe.flee; sideFoe.mesh.rotation.y= fl? Math.atan2(-dx,-dz) : Math.atan2(dx,dz);
    if(d>2.3){ if(fl){ moveFoe(sideFoe,-dx/(d||1)*4.6,-dz/(d||1)*4.6,dt); sideFoe.mesh.userData.walk+=dt*4.6*2.2; poseWalk(sideFoe.mesh,1); } /* ROUND 10: BURONAN KABUR dari pemain (4,6 — kalah dari sprint 8,5, jadi masih bisa dikejar) */ else { moveFoe(sideFoe,dx/(d||1)*3.4,dz/(d||1)*3.4,dt); sideFoe.mesh.userData.walk+=dt*3.4*2.2; poseWalk(sideFoe.mesh,1); } }
    else { sideFoe.atkCd-=dt; if(sideFoe.atkCd<=0){ sideFoe.atkCd=1; if(AC) beep(160,.12,"square",.15); if(inCar){ damageCar(inCar,3); toast("🎯 Target memukul mobilmu!"); } else { health-=5; toast("🎯 Target buruan memukulmu! ❤️ "+Math.max(0,Math.round(health))+"%"); updateHUD(); if(health<=0){ onPlayerDown("Kamu tumbang oleh target buruan. Misi sampingan dibatalkan — misi utama diulang dari checkpoint."); return; } } } } } } }
 updateSideInfo(); }
/* MODAL PILIH MISI SAMPINGAN — daftar 3 misi + status; item memakai gaya baris toko yang sama */
function openSideModal(){ if(!gameStarted) return; initAudio(); document.querySelectorAll(".modal").forEach(function(m){ m.classList.remove("on"); }); paused=true; renderSideList(); document.getElementById("modalSide").classList.add("on"); }
function renderSideList(){ var un=sideUnlocked(); document.getElementById("sideIntro").innerHTML= un? "Pilih misi sampingan — semuanya <b>bisa diulang</b> dan berhadiah uang. Target ditandai <b style='color:#ffb300'>penanda emas</b> di dunia &amp; peta." : "🔒 Misi sampingan terbuka setelah kamu menyelesaikan <b>MISI 2 — ANTAR CEPAT</b>. Selesaikan misi utama sampai sana dulu!"; var h="";
 if(side.active){ var def=SIDE_DEFS[side.type]; h+='<div class="shopItem"><div><div class="siName">'+def.name+' — SEDANG BERJALAN</div><div class="siDesc">'+side.label+'</div></div><button data-side="cancel">BATALKAN</button></div>'; }
 ["kurir","kilat","balap","buru","buronan"].forEach(function(k){ var def=SIDE_DEFS[k]; var dis= !un||side.active; h+='<div class="shopItem"><div><div class="siName">'+def.name+' • Hadiah $'+def.reward+'</div><div class="siDesc">'+def.desc+'<br>Sudah diselesaikan: '+side.done[k]+'×</div></div><button data-side="'+k+'"'+(dis?" disabled":"")+'>MULAI</button></div>'; });
 document.getElementById("sideList").innerHTML=h;
 document.querySelectorAll("#sideList [data-side]").forEach(function(b){ b.onclick=function(){ var a=b.getAttribute("data-side"); closeModals(); if(a==="cancel") cancelSideMission(false); else startSideMission(a); }; }); }
document.getElementById("btnSide").onclick=function(){ openSideModal(); };
document.getElementById("btnSideTop").onclick=function(){ openSideModal(); };
/* MAPS */
var minimapBroken=false;
function drawMap(cv,scale){ if(minimapBroken||!cv) return; try{
 var g=cv.getContext("2d"); if(!g) throw new Error("no 2d context");
 var W=cv.width, cx=W/2, cz=W/2;
 g.fillStyle="#2e7d46"; g.fillRect(0,0,W,W);
 // park
 g.fillStyle="#57a047"; g.fillRect(cx+(-18-10)*scale, cz+(-54-10)*scale, 20*scale, 20*scale); /* taman di blok (-18,-54) */
 // roads
 g.strokeStyle="#111214"; g.lineWidth=Math.max(4,11*scale); g.lineCap="butt"; /* jalan di peta juga hitam, sama seperti aspal 3D */
 for(var i=-2;i<=2;i++){ g.beginPath(); g.moveTo(cx+i*36*scale,0); g.lineTo(cx+i*36*scale,W); g.stroke(); g.beginPath(); g.moveTo(0,cz+i*36*scale); g.lineTo(W,cz+i*36*scale); g.stroke(); }
 // buildings (from colliders)
 g.fillStyle="rgba(245,242,230,.6)";
 for(var ci2=0;ci2<colliders.length;ci2++){ var cc=colliders[ci2]; var bs=Math.max(3,cc.r*1.5*scale); g.fillRect(cx+cc.x*scale-bs/2, cz+cc.z*scale-bs/2, bs, bs); }
 // danau tepi kota (digambar SETELAH loop collider supaya lingkaran air menimpa kotak collider danaunya sendiri)
 if(typeof LAKES!=="undefined"){ g.fillStyle="#3d9bc4"; LAKES.forEach(function(L){ g.beginPath(); g.arc(cx+L.x*scale,cz+L.z*scale,L.r*scale,0,7); g.fill(); }); }
 // jembatan gantung kuning di tepi timur (garis kuning di ujung kanan peta, searah jalan tengah)
 g.strokeStyle="#f5b301"; g.lineWidth=3; g.beginPath(); g.moveTo(cx+106*scale,cz); g.lineTo(cx+230*scale,cz); g.stroke(); /* garis kini mencakup tanjakan barat (106) sampai tanjakan timur (230) — jembatan tersambung ke jalan */
 // traffic cars
 g.fillStyle="#ffd166"; cars.forEach(function(c){ g.fillRect(cx+c.position.x*scale-2.5,cz+c.position.z*scale-2.5,5,5); });
 // TAHAP 3: penanda polisi di peta — mobil patroli & polisi jalan kaki kotak biru, helikopter polisi lingkaran biru
 g.fillStyle="#4da3ff"; police.forEach(function(c){ if(c.visible) g.fillRect(cx+c.position.x*scale-3,cz+c.position.z*scale-3,6,6); });
 if(typeof footCops!=="undefined") footCops.forEach(function(fc){ if(fc.mesh.visible) g.fillRect(cx+fc.mesh.position.x*scale-2.5,cz+fc.mesh.position.z*scale-2.5,5,5); });
 if(typeof polHeliOn!=="undefined"&&polHeliOn&&policeHeli){ g.strokeStyle="#4da3ff"; g.lineWidth=2; g.beginPath(); g.arc(cx+policeHeli.g.position.x*scale,cz+policeHeli.g.position.z*scale,6,0,7); g.stroke(); }
 // toko-toko: lingkaran berwarna bertanda huruf ($ = Toko Seja, B = Bengkel, + = SPBU)
 SHOPS.forEach(function(s){ g.fillStyle="#"+("000000"+s.col.toString(16)).slice(-6); g.beginPath(); g.arc(cx+s.x*scale,cz+s.z*scale,6.5,0,7); g.fill(); g.fillStyle="#231400"; g.font="bold 10px sans-serif"; g.textAlign="center"; g.fillText(s.mark,cx+s.x*scale,cz+s.z*scale+3.5); g.textAlign="left"; });
 // RUMAH BISA DIMASUKI: titik oranye bertanda "H" di posisi pintu rumah
 if(typeof HOUSES!=="undefined") HOUSES.forEach(function(hs){ g.fillStyle="#ffb36b"; g.beginPath(); g.arc(cx+hs.dx*scale,cz+hs.dz*scale,5.5,0,7); g.fill(); g.fillStyle="#231400"; g.font="bold 8px sans-serif"; g.textAlign="center"; g.fillText("H",cx+hs.dx*scale,cz+hs.dz*scale+2.8); g.textAlign="left"; });
 // pickup aktif: medkit merah muda, uang hijau
 pickups.forEach(function(p){ if(!p.active) return; g.fillStyle= p.kind==="medkit"? "#ff5e7a" : "#7CFC00"; g.fillRect(cx+p.x*scale-2.5,cz+p.z*scale-2.5,5,5); });
 // mission marker (pulsing ring)
 var m=missions[missionIdx]; if(m){ var pr=8+Math.sin(performance.now()*.006)*2.5; g.fillStyle="#ff2e55"; g.beginPath(); g.arc(cx+m.x*scale,cz+m.z*scale,7,0,7); g.fill(); g.strokeStyle="#ff2e55"; g.lineWidth=2; g.beginPath(); g.arc(cx+m.x*scale,cz+m.z*scale,pr+4,0,7); g.stroke(); }
 // TAHAP 4: target misi sampingan — lingkaran emas berdenyut
 if(typeof side!=="undefined"&&side.active){ var spr=7+Math.sin(performance.now()*.006)*2; g.fillStyle="#ffb300"; g.beginPath(); g.arc(cx+side.tx*scale,cz+side.tz*scale,6,0,7); g.fill(); g.strokeStyle="#ffb300"; g.lineWidth=2; g.beginPath(); g.arc(cx+side.tx*scale,cz+side.tz*scale,spr+3,0,7); g.stroke(); }
 // player dot with heading tick
 var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z;
 var pa=inCar?inCar.userData.angle:player.rotation.y;
 g.strokeStyle="#00e5ff"; g.lineWidth=3; g.beginPath(); g.moveTo(cx+px*scale,cz+pz*scale); g.lineTo(cx+(px+Math.sin(pa)*7)*scale, cz+(pz+Math.cos(pa)*7)*scale); g.stroke();
 g.fillStyle="#00e5ff"; g.beginPath(); g.arc(cx+px*scale,cz+pz*scale,6.5,0,7); g.fill(); g.strokeStyle="#fff"; g.lineWidth=2; g.stroke();
 }catch(e){ minimapBroken=true; var w=document.getElementById("minimapWrap"); if(w) w.style.display="none"; } }
function drawBigMap(){ drawMap(document.getElementById("bigMapCanvas"),1.9); var g=document.getElementById("bigMapCanvas").getContext("2d"); g.fillStyle="#fff"; g.font="bold 15px sans-serif"; g.fillText("MARINA",40,50); g.fillText("BUKIT HALCYON",430,50); g.fillText("PELABUHAN",40,600); g.fillText("NEON STRIP",450,600); g.fillText("TAMAN SENJA",270,300); }
function updateHUD(){ document.getElementById("money").textContent=money; document.getElementById("health").textContent=Math.max(0,Math.round(health)); var s=""; for(var i=0;i<5;i++) s+= i<Math.floor(wanted)?"★":"☆"; document.getElementById("stars").textContent=s; var wn=weapons[weaponIdx]; document.getElementById("weapon").textContent= isGun(wn)? wn+" • "+(ammo[wn]||0) : wn; var wpill=document.getElementById("weapon").parentNode; if(wpill) wpill.style.color= (isGun(wn)&&(ammo[wn]||0)<=0)? "#ff8fa3" : ""; /* indikator amunisi: pill senjata memerah saat peluru habis */
 var mkn=document.getElementById("medkitN"); if(mkn) mkn.textContent=medkits; var bmk=document.getElementById("btnMedkit"); if(bmk) bmk.textContent= medkits>0? "💊"+medkits : "💊";
 var sl=document.getElementById("storyLine"); if(sl){ var sd=0; if(typeof side!=="undefined"&&side.done){ for(var sdk in side.done) sd+=side.done[sdk]; } sl.textContent="📖 CERITA "+Math.min(5,missionIdx)+"/5 • 🎯 Sampingan: "+sd; } /* ROUND 10: skala cerita di HUD — naik tiap misi utama selesai + hitungan misi sampingan */
 var cp=document.getElementById("carPill"); if(cp){ if(inCar){ cp.style.display=""; document.getElementById("carHp").textContent=Math.max(0,Math.round(inCar.userData.hp)); document.getElementById("carFuel").textContent=Math.max(0,Math.round(inCar.userData.fuel)); cp.style.color= inCar.userData.hp<30? "#ff8fa3" : ""; } else cp.style.display="none"; } /* TAHAP 3: pill health+bensin mobil, hanya saat mengemudi */ }
/* GAME LOOP */
var clockT=11.5, last=performance.now(), camAngle=0, carSpeed=0, drift=0, menuOrbit=0, minimapTick=0, saveTick=0, lastHurtAt=0, prevHealth=100; /* SPEC 12:33: jam awal 11:30 (dulu 17:40 senja) — kesan pertama siang biru cerah; sore/malam tetap datang saat jam berjalan */
function collide(x,z){ for(var i=0;i<colliders.length;i++){ var c=colliders[i]; if(Math.hypot(x-c.x,z-c.z)<c.r) return true; } return Math.abs(x)>105||Math.abs(z)>105; }
function animate(){ requestAnimationFrame(animate); var now=performance.now(), dt=Math.min(.05,(now-last)/1000); last=now;
 // day-night cycle (full cycle ~4 min, starts sunset)
 clockT=(clockT+dt*.045)%24; var sunA=((clockT-6)/12)*Math.PI; var elev=Math.sin(sunA); var isNight=elev<0;
 updateSkyDome(elev);
 sun.position.set(Math.cos(sunA)*120, Math.max(8,elev*110), 60); sunSprite.position.copy(sun.position).multiplyScalar(2.2);
 /* SIANG CERAH: seiring matahari naik, lampu bergeser dari jingga senja ke putih-biru terang —
    intensitas matahari/ambient/hemisphere naik, warna bangunan & aspal keluar, kabut menipis.
    Saat elev turun lagi (sore) semua kembali jingga, dan malam tetap redup neon seperti sebelumnya. */
 var dayF=Math.max(0,Math.min(1,(elev-.03)/.5));
 sun.intensity= isNight? .25 : 1.12+dayF*.6; sun.color.setHex(0xffb36b).lerp(_daySun,dayF);
 amb.intensity=.42+dayF*.42; amb.color.setHex(0xffd9b0).lerp(_dayAmb,dayF);
 hemi.intensity=.34+dayF*.48; hemi.color.setHex(0xff9e7a).lerp(_dayHemiSky,dayF); hemi.groundColor.setHex(0x2b1a4a).lerp(_dayHemiGnd,dayF);
 scene.fog.far=430+dayF*90;
 var hh=Math.floor(clockT), mm=Math.floor((clockT-hh)*60); document.getElementById("clock").textContent=(hh<10?"0":"")+hh+":"+(mm<10?"0":"")+mm;
 clouds.forEach(function(c,i){ c.position.x+=dt*(1+i*.2); if(c.position.x>180) c.position.x=-180; }); /* ROUND 9: batas wrap drift disesuaikan ke sebaran awan baru ±170 */
 updateHelis(dt,now); /* helikopter hiasan terbang juga di latar menu */
 trees.forEach(function(t){ t.rotation.z=Math.sin(now*.001+t.userData.sway)*.03; });
 ocean.position.x=Math.sin(now*.0003)*4;
 if(!gameStarted){ menuOrbit+=dt*.07; camera.position.set(Math.sin(menuOrbit)*62,20+Math.sin(menuOrbit*.6)*5,Math.cos(menuOrbit)*62); camera.lookAt(0,7,0);
   // menu traffic + peds keep moving below
   updateTraffic(dt,true); updatePeds(dt,now); drawFrame(); return; }
 if(paused){ drawFrame(); return; }
 /* PLAYER / CAR */
 var fwdX=0,fwdZ=0;
 if(inCar){
   var steer=-(joy.x)+(keys["KeyA"]||keys["ArrowLeft"]? .8:0)+(keys["KeyD"]||keys["ArrowRight"]? -.8:0);
   var gas=(btnA||keys["KeyW"]||keys["ArrowUp"])?1:0; var rev=(btnRevHeld||keys["KeyS"]||keys["ArrowDown"]||joy.y>.45)?.7:0; /* mundur: tombol MUNDUR (tahan) / S / Panah Bawah / joystick ke bawah */
   var handbrake=keys["Space"];
   var fuelCap= inCar.userData.fuel>0? (inCar.userData.maxSpd||26) : 4; /* TAHAP 3: bensin habis = mobil hanya bisa merayap */
   if(gas) carSpeed=Math.min(carSpeed+dt*16, inCar.userData.parked?0:fuelCap); else if(rev) carSpeed=Math.max(carSpeed-dt*14,-9); else carSpeed*=Math.pow(.4,dt);
   if(Math.abs(carSpeed)>1&&!inCar.userData.burnt){ inCar.userData.fuel=Math.max(0,inCar.userData.fuel-dt*.45); /* bensin terkuras selama mobil berjalan */
     if(inCar.userData.fuel<=0){ if(!inCar.userData.fuelEmpty){ inCar.userData.fuelEmpty=true; toast("⛽ BENSIN HABIS! Mobil hanya bisa merayap — isi bensin di SPBU atau BENGKEL."); if(AC) beep(196,.3,"square",.2); } }
     else if(inCar.userData.fuel<20&&!inCar.userData.fuelWarned){ inCar.userData.fuelWarned=true; toast("⛽ Bensin tinggal "+Math.round(inCar.userData.fuel)+"% — mampir SPBU / BENGKEL!"); } }
   if(handbrake&&Math.abs(carSpeed)>6){ drift=steer*1.6; carSpeed*=Math.pow(.55,dt); } else drift*=Math.pow(.02,dt);
   if(Math.abs(carSpeed)>.3) inCar.userData.angle+= steer*dt*(carSpeed>0?1:-1)*.85 + drift*dt;
   var nx=inCar.position.x+Math.sin(inCar.userData.angle)*carSpeed*dt, nz=inCar.position.z+Math.cos(inCar.userData.angle)*carSpeed*dt;
   if(!collide(nx,nz)){ inCar.position.x=nx; inCar.position.z=nz; } else { if(Math.abs(carSpeed)>7){ var cdmg=Math.round((Math.abs(carSpeed)-6)*1.8); damageCar(inCar,cdmg); wanted=Math.min(5,wanted+.2); if(inCar&&!inCar.userData.burnt){ toast("💥 TABRAKAN! Health mobil: "+Math.max(0,Math.round(inCar.userData.hp))+"%"+(inCar.userData.hp<45?" — mobil BERASAP! Perbaiki di BENGKEL":"")); sfxCrash(1); if(navigator.vibrate) navigator.vibrate(90); } } carSpeed*=-.3; }
   if(inCar){ /* mobil bisa MELEDAK di tabrakan tadi (explodeCar mengosongkan inCar) — sisa langkah hanya bila masih di mobil */
   inCar.rotation.y=inCar.userData.angle;
   if(inCar.userData.wheels) inCar.userData.wheels.forEach(function(w){ w.rotation.x+=carSpeed*dt*2; });
   player.position.copy(inCar.position);
   if(lightsOn){ headlight.intensity=2.2; headlight.position.set(inCar.position.x+Math.sin(inCar.userData.angle)*2.2,1.1,inCar.position.z+Math.cos(inCar.userData.angle)*2.2); headlight.target.position.set(inCar.position.x+Math.sin(inCar.userData.angle)*16,0,inCar.position.z+Math.cos(inCar.userData.angle)*16); } else headlight.intensity=0; }
 } else {
   var mx=joy.x+(keys["KeyD"]?1:0)-(keys["KeyA"]?1:0), mz=joy.y+(keys["KeyS"]?1:0)-(keys["KeyW"]?1:0);
   var mag=Math.hypot(mx,mz); var sprint=btnA||keys["ShiftLeft"]||keys["ShiftRight"];
   if(mag>.12){ /* gerakan RELATIF KAMERA: dorong joystick ke atas layar = jalan menjauhi kamera (arah pandang), kanan = kanan layar */
     var cl=Math.min(1,mag), inX=mx/mag*cl, inZ=mz/mag*cl;
     var effYaw= camMode==="top"?0:camYaw;
     var fX=-Math.sin(effYaw), fZ=-Math.cos(effYaw); /* arah depan kamera di tanah */
     var rX=-fZ, rZ=fX; /* arah kanan kamera di tanah */
     var moveX=fX*(-inZ)+rX*inX, moveZ=fZ*(-inZ)+rZ*inX;
     var spd=(sprint?8.5:4.6)*(cl<1? .45+.55*cl : 1);
     var wx=moveX*spd*dt, wz=moveZ*spd*dt;
     var curIn=collide(player.position.x,player.position.z); /* kalau sudah terlanjur di dalam collider (mis. keluar mobil mepet gedung), gerakan keluar harus tetap boleh — jangan kunci pemain selamanya */
     if(curIn||!collide(player.position.x+wx,player.position.z)) player.position.x+=wx;
     if(curIn||!collide(player.position.x,player.position.z+wz)) player.position.z+=wz;
     /* hadap dibelokkan MULUS (jalur busur terpendek) ke arah gerak, bukan membentak seketika — bentakan + noise analog joystick bikin karakter berkedut */
     var targetA=Math.atan2(moveX,moveZ), dA=targetA-player.rotation.y; while(dA>Math.PI)dA-=Math.PI*2; while(dA<-Math.PI)dA+=Math.PI*2; player.rotation.y+=dA*Math.min(1,dt*15); playerAngle=player.rotation.y;
     /* fase langkah diikat ke KECEPATAN NYATA (spd sudah termasuk faktor analog) — versi lama fase tetap dt*9/13 berapa pun kecepatan dorongnya, jadi kaki meluncur/skating di atas tanah */
     player.userData.gait=Math.min(1,(player.userData.gait||0)+dt*9); player.userData.walk+=dt*spd*2.2;
   }
   /* gait mereda saat input berhenti dan pose terus diterapkan selama gait>0: tungkai kembali netral dengan halus, tidak membeku miring di tengah ayunan */
   if(mag<=.12&&player.userData.gait>0) player.userData.gait=Math.max(0,player.userData.gait-dt*7);
   if(player.userData.gait>0) poseWalk(player,player.userData.gait); else { if(player.position.y!==0) player.position.y=0; idlePose(player,now); } /* diam total: pose napas halus + lengan menekuk natural */
   /* KNOCKBACK tertabrak mobil: dorongan terpental yang mereda, tetap menghormati collider gedung */
   if(knock.x||knock.z){ var kxx=knock.x*dt, kzz=knock.z*dt, curInK=collide(player.position.x,player.position.z); if(curInK||!collide(player.position.x+kxx,player.position.z)) player.position.x+=kxx; if(curInK||!collide(player.position.x,player.position.z+kzz)) player.position.z+=kzz; var kdec=Math.pow(.002,dt); knock.x*=kdec; knock.z*=kdec; if(Math.abs(knock.x)<.05) knock.x=0; if(Math.abs(knock.z)<.05) knock.z=0; }
   /* DI DALAM RUMAH: jepit pemain tetap di dalam ruangan, kembalikan tinggi dasar ke lantai interior
      (poseWalk menulis y absolut 0..0,05), dan dorong keluar dari perabot (INT_SOLIDS) */
   if(inHouse){ player.position.x=Math.max(INT.x-INT.hw+.7,Math.min(INT.x+INT.hw-.7,player.position.x)); player.position.z=Math.max(INT.z-INT.hd+.7,Math.min(INT.z+INT.hd-.7,player.position.z)); player.position.y=INT.y+Math.max(0,player.position.y);
    for(var is2=0;is2<INT_SOLIDS.length;is2++){ var so=INT_SOLIDS[is2], sdx=player.position.x-so.x, sdz=player.position.z-so.z, sd=Math.hypot(sdx,sdz); if(sd<so.r&&sd>.001){ player.position.x=so.x+sdx/sd*so.r; player.position.z=so.z+sdz/sd*so.r; } } }
   if(keys["KeyF"]) attack(); /* tahan F = serang terus (laju diatur cooldown; SMG otomatis) */
   if(bAuto&&weapons[weaponIdx]==="SMG") attack(); /* tahan B di HP = SMG menembak otomatis */
   carSpeed=0;
 }
 /* traffic, peds, police */
 updateTraffic(dt,false); updatePeds(dt,now); updatePolice(dt); updateTrafficLights(); updateRoadblocks();
 updateWanted(dt); if(wanted>=1) updatePoliceActive(dt); /* TAHAP 4: wanted TIDAK lagi luruh sendiri — hanya turun bila polisi kehilangan jejak (lihat updateWanted) */
 updateFootPolice(dt); updatePoliceHeli(dt,now); /* TAHAP 3: polisi jalan kaki (wanted 2+) & helikopter polisi (wanted 4–5) */
 /* mission check — TAHAP 1: logika per misi (paket/mobil+timer/wanted/dialog/bos) */
 checkMission(dt,now);
 updateSide(dt,now); /* TAHAP 4: misi sampingan (kurir / balapan checkpoint / buru target) berjalan di samping misi utama */
 tutAutoCheck(now); /* ROUND 10: tutorial kartu kecil maju otomatis saat pemain melakukan aksinya */
 /* TAHAP 3 — regen HP: pulih pelan (+2,2/dtk) setelah 6 detik tanpa menerima damage apa pun */
 if(health<prevHealth) lastHurtAt=now; prevHealth=health;
 if(health>0&&health<100&&now-lastHurtAt>6000) health=Math.min(100,health+dt*2.2);
 updatePickups(dt,now); updateDrops(dt,now); updateCarFx(dt,now);
 /* camera */
 var fx=inCar?inCar.position.x:player.position.x, fz=inCar?inCar.position.z:player.position.z, fy=inCar?1:1.6;
 if(inHouse){ /* DI DALAM RUMAH: kamera jarak dekat & DIJEPIT tetap di dalam ruangan (tidak menembus dinding/lantai/langit-langit); mode top-down pun diambil dari dalam ruangan */
   if(camMode==="top"){ camera.position.set(fx,INT.y+3.05,fz+2.7); camera.lookAt(fx,INT.y,fz); }
   else { var iHd=Math.cos(camPitch)*3.6, iY=INT.y+1.5+Math.sin(camPitch)*2, iX=fx+Math.sin(camYaw)*iHd, iZ=fz+Math.cos(camYaw)*iHd; iX=Math.max(INT.x-INT.hw+.45,Math.min(INT.x+INT.hw-.45,iX)); iZ=Math.max(INT.z-INT.hd+.45,Math.min(INT.z+INT.hd-.45,iZ)); iY=Math.max(INT.y+.6,Math.min(INT.y+3.3,iY)); camera.position.lerp(new THREE.Vector3(iX,iY,iZ), look.id!==null?0.4:0.3); camera.lookAt(fx,INT.y+1.5,fz); } }
 else if(camMode==="top"){ camera.position.set(fx,52,fz+.01); camera.lookAt(fx,0,fz); }
 else { /* ORBIT BEBAS 360°: posisi kamera hanya dari camYaw/camPitch (look-drag di kanan layar), tidak lagi dihitung dari arah hadap pemain/mobil — kamera tidak terkunci di belakang karakter */
   var dist=inCar?12:9; var hd=Math.cos(camPitch)*dist, vd=Math.max(.55,Math.sin(camPitch)*dist+1.1); /* SPEC 12:33: jarak kamera sedikit lebih jauh (9 jalan kaki / 12 mobil, dulu 7,5/10,5) supaya jalan, palem & horizon masuk bingkai */
   var desired=new THREE.Vector3(fx+Math.sin(camYaw)*hd, vd, fz+Math.cos(camYaw)*hd); camera.position.lerp(desired, look.id!==null?0.35:0.14); var lookY= fy + (camPitch<0? -camPitch*11 : 0); /* pitch negatif: target pandang NAIK ke langit, jadi pandangan benar-benar mendongak dan helikopter masuk bingkai */ camera.lookAt(fx,lookY,fz); camAngle=camYaw; }
 updateCombatFx(dt,now); updateABThrottled(now); updateHUD();
 minimapTick+=dt; if(minimapTick>.12){ minimapTick=0; drawMap(document.getElementById("minimap"),.82); }
 saveTick+=dt; if(saveTick>5){ saveTick=0; if(gameStarted&&!paused) persistSave(); } /* autosave 5 detik: reload webview di tengah main tidak lagi menghapus progres */
 perfCheck(dt,now); /* TAHAP 5 (lanjutan): deteksi FPS rendah berkelanjutan — hanya berjalan saat main aktif (bukan menu/pause, karena animate berhenti di cabang pause sebelum baris ini) */
 drawFrame();
}
var lastAB=0; function updateABThrottled(now){ if(now-lastAB>400){ lastAB=now; if(!inCar) updateAB(); var sbt=document.getElementById("btnSideTop"); if(sbt) sbt.style.display= (typeof sideUnlocked==="function"&&sideUnlocked())? "" : "none"; /* TAHAP 4: tombol 🎯 hanya tampil setelah misi sampingan terbuka */ var sb=document.getElementById("btnShopFloat"); if(sb){ nearShop=nearestShop(); sb.classList.toggle("on", !!nearShop); if(nearShop){ var sml=sb.querySelector("small"); if(sml) sml.textContent=nearShop.short; } } var bh=document.getElementById("btnHouseFloat"); if(bh){ var showH=false, labH="MASUK"; if(inHouse){ if(atExitDoor()){ showH=true; labH="KELUAR"; } } else { nearHouse=houseDoorNear(); if(nearHouse) showH=true; } bh.classList.toggle("on",showH); if(showH){ var shl=bh.querySelector("small"); if(shl) shl.textContent=labH; } } } }
/* TABRAKAN MOBIL -> PEMAIN — keluhan user: "ada mobil lewat, kita di depannya, kita tembus gak ketabrak".
   Versi lama: mobil lalu lintas tidak pernah mengecek pemain sama sekali. Kini: mobil MENGEREM bila pemain
   berdiri di depannya; bila jarak sudah terlalu dekat & mobil masih melaju, pemain TERTABRAK: terpental
   (knockback), kehilangan health sesuai kecepatan mobil, jeda kebal 0,9 detik supaya tidak terkuras seketika. */
function hitPlayerByCar(c,u){ var now=performance.now(); if(now-lastCarHitAt<900) return; lastCarHitAt=now; var dmg=Math.round(Math.min(24,7+u.spd*1.15)); health-=dmg; var ax=player.position.x-c.position.x, az=player.position.z-c.position.z, ad=Math.hypot(ax,az)||1; knock.x+=Math.sin(u.angle)*11+ax/ad*4; knock.z+=Math.cos(u.angle)*11+az/ad*4; toast("🚗💥 TERTABRAK MOBIL! ❤️ -"+dmg+"% — hati-hati menyeberang!"); sfxCrash(.9); if(navigator.vibrate) navigator.vibrate(140); updateHUD(); if(health<=0) onPlayerDown("Kamu tertabrak mobil lalu lintas dan pingsan. Misi diulang dari checkpoint — lihat kiri-kanan sebelum menyeberang!"); }
function updateTraffic(dt,menuOnly){ var tlsT=tlState(); cars.forEach(function(c){ if(c===inCar||c.userData.parked||c.userData.burnt) return; var u=c.userData; if(u.eff==null) u.eff=u.spd; var target=u.spd;
 /* TAHAP 4 — LAMPU MERAH: berhenti mulus di garis henti (±7,6 sebelum garis simpang) bila lampu untuk arah
    jalannya merah. Arah diambil dari ANGLE saat ini (bukan u.dir — angle bisa berbalik di ujung kota). */
 var dsgn= u.horiz? (Math.sin(u.angle)>0?1:-1) : (Math.cos(u.angle)>0?1:-1);
 if(u.horiz? !tlsT.ew : !tlsT.ns){ for(var tli=0;tli<ROADS.length;tli++){ var slp= dsgn>0? ROADS[tli]-7.6 : ROADS[tli]+7.6; var sld= (u.horiz? (slp-c.position.x) : (slp-c.position.z))*dsgn; if(sld>.4&&sld<10){ target=Math.min(target, u.spd*Math.max(0,(sld-1.2)/8)); break; } } }
 /* TAHAP 4 — JAGA JARAK: perlambat di belakang mobil SEARAH di depannya (termasuk mobil pemain);
    mobil berlawanan arah dilewati seperti biasa (uji titik arah hadap > 0,5). */
 for(var toi=0;toi<cars.length;toi++){ var oc=cars[toi]; if(oc===c||oc.userData.burnt) continue; var cox=oc.position.x-c.position.x, coz=oc.position.z-c.position.z; var cal=cox*Math.sin(u.angle)+coz*Math.cos(u.angle); if(cal<.5||cal>7.5) continue; var cla=Math.abs(cox*Math.cos(u.angle)-coz*Math.sin(u.angle)); if(cla>2.3) continue; if((Math.sin(u.angle)*Math.sin(oc.userData.angle)+Math.cos(u.angle)*Math.cos(oc.userData.angle))<=.5) continue; var osp= oc===inCar? Math.abs(carSpeed) : (oc.userData.parked? 0 : (oc.userData.eff==null? oc.userData.spd : oc.userData.eff)); target=Math.min(target, osp+Math.max(0,cal-4.5)*1.2); }
 if(!menuOnly&&gameStarted&&!inCar){ var pdx=player.position.x-c.position.x, pdz=player.position.z-c.position.z, pd=Math.hypot(pdx,pdz);
  if(pd<8){ var ahead=pdx*Math.sin(u.angle)+pdz*Math.cos(u.angle); if(ahead>.4) target= pd<3.4? 0 : u.spd*Math.min(1,(pd-3.4)/5); /* target rem: berhenti ~3,4 di depan pemain */
   if(pd<2.5&&u.eff>3) hitPlayerByCar(c,u); } }
 /* kecepatan efektif berubah BERTAHAP (rem mendadak pun butuh jarak) — pemain yang nekat menerobos di depan mobil yang dekat tetap tertabrak */
 var rate= target<u.eff? 16:7; u.eff+= Math.max(-rate*dt, Math.min(rate*dt, target-u.eff)); var spd=u.eff;
 var nx=c.position.x+Math.sin(u.angle)*spd*dt, nz=c.position.z+Math.cos(u.angle)*spd*dt; if(Math.abs(nx)>104||Math.abs(nz)>104||collide(nx,nz)){ u.angle+=Math.PI; return; } /* collide() di sini = jaminan mobil lalu lintas TIDAK PERNAH masuk collider gedung/toko */ c.position.x=nx; c.position.z=nz; c.rotation.y=u.angle; if(u.wheels) u.wheels.forEach(function(w){ w.rotation.x+=spd*dt*1.6; }); }); }
function updatePeds(dt,now){ peds.forEach(function(p){ var u=p.userData;
 if(u.deadT>0){ u.deadT-=dt; if(u.deadT<=0) respawnPed(p); return; } /* tumbang: rebah 18 detik lalu bangkit di trotoar */
 if(u.fleeT>0){ /* KABUR: lari menjauhi sumber bahaya (tembakan/serangan), tangan terangkat; selesai -> kembali ke trotoar */
  u.fleeT-=dt; var fdx=p.position.x-(u.fleeX||0), fdz=p.position.z-(u.fleeZ||0), fd=Math.hypot(fdx,fdz)||1, fdir=Math.atan2(fdx/fd,fdz/fd);
  p.position.x=Math.max(-104,Math.min(104,p.position.x+Math.sin(fdir)*5.4*dt)); p.position.z=Math.max(-104,Math.min(104,p.position.z+Math.cos(fdir)*5.4*dt)); p.rotation.y=fdir; u.walk+=dt*5.4*2.2; poseWalk(p,1); if(u.armL) u.armL.rotation.x=-2.7; if(u.armR) u.armR.rotation.x=-2.7;
  if(u.fleeT<=0){ u.nx=nearestSwIdx(p.position.x); u.nz=nearestSwIdx(p.position.z); u.hasTarget=false; } return; }
 if(!u.hasTarget) pickPedTarget(p); /* jalan santai menyusuri jaringan trotoar, simpul ke simpul */
 var tx2=SW_OFFS[u.tx], tz2=SW_OFFS[u.tz], dx=tx2-p.position.x, dz=tz2-p.position.z, d=Math.hypot(dx,dz);
 if(d<.7){ u.nx=u.tx; u.nz=u.tz; u.hasTarget=false; }
 else { var dir=Math.atan2(dx,dz); u.dir=dir; p.position.x+=Math.sin(dir)*u.spd*dt; p.position.z+=Math.cos(dir)*u.spd*dt; p.rotation.y=dir; u.walk+=dt*u.spd*2.2; poseWalk(p,1); }
 /* TABRAKAN MOBIL -> PEJALAN KAKI (ROUND 10, wanted): hanya tabrakan MOBIL BERKECEPATAN TINGGI
   (>7, sama dengan ambang tabrakan ke rintangan) yang melukai pejalan kaki & menaikkan wanted.
   Senggolan pelan (<=7) — misalnya merayap di kemacetan — TIDAK melukai dan TIDAK kena wanted,
   sama seperti jalan kaki yang menabrak NPC: pejalan kaki cukup kabur (damagePed/flee). */
 if(inCar&&Math.hypot(p.position.x-inCar.position.x,p.position.z-inCar.position.z)<1.7&&Math.abs(carSpeed)>7){ damagePed(p,16,inCar.position.x,inCar.position.z); wanted=Math.min(5,wanted+.8); toast("⚠️ Kamu menabrak pejalan kaki!"); }
 }); }
function updatePolice(dt){ var active=wanted>=1; police.forEach(function(pc,i){ pc.visible=active; if(pc.userData.bar) pc.userData.bar.material.color.setHex(Math.floor(performance.now()/300)%2?0xff2222:0x2266ff); }); }
/* ============ TAHAP 4 — POLISI & LALU LINTAS ============
   Polisi kini MENGEJAR LEWAT JALAN: kemudi (steering) dengan batas putar, dan bila pemain jauh /
   terhalang gedung, polisi membidik WAYPOINT persimpangan terdekat yang paling mendekatkan ke pemain —
   tidak lagi meluncur menempel dinding gedung dan tersangkut. Wanted hanya turun bila polisi KEHILANGAN
   JEJAK (pemain jauh + tak terlihat > 6 detik) atau pemain GANTI MOBIL. Wanted 4–5: ROADBLOCK menutup
   jalan di depan pemain + sirene dua nada berbunyi bila polisi dekat. */
var hiddenT=0, lastSeenCar=null, sirenT=0, sirenHi=false;
function losClear(x1,z1,x2,z2){ var d=Math.hypot(x2-x1,z2-z1), n=Math.max(2,Math.ceil(d/3)); for(var i=1;i<n;i++){ var t=i/n; if(collide(x1+(x2-x1)*t,z1+(z2-z1)*t)) return false; } return true; }
function pickWp(px,pz,tx,tz){ var best=null,bs=1e9; ROADS.forEach(function(rx){ ROADS.forEach(function(rz){ var dw=Math.hypot(rx-px,rz-pz); if(dw<5) return; /* simpang yang sedang diinjak polisi tidak dipilih lagi — versi lama memilih simpang terdekat ke pemain dari sana, sehingga polisi menembus blok secara diagonal dan menempel di dinding gedung */ var s=dw*.55+Math.hypot(rx-tx,rz-tz)*1.25; if(s<bs){ bs=s; best={x:rx,z:rz}; } }); }); if(!best){ var bd=1e9; ROADS.forEach(function(rx){ ROADS.forEach(function(rz){ var s=Math.hypot(rx-tx,rz-tz); if(s<bd){ bd=s; best={x:rx,z:rz}; } }); }); } return best; }
function roadSnap(x,z){ var bx=ROADS[0],bz=ROADS[0],dx=1e9,dz=1e9; ROADS.forEach(function(r){ if(Math.abs(x-r)<dx){ dx=Math.abs(x-r); bx=r; } if(Math.abs(z-r)<dz){ dz=Math.abs(z-r); bz=r; } }); var p= dx<dz? {x:bx,z:Math.max(-100,Math.min(100,z))} : {x:Math.max(-100,Math.min(100,x)),z:bz}; if(collide(p.x,p.z)) p=findSafeNear(p.x,p.z); return p; }
function updateWanted(dt){ if(wanted<=0){ hiddenT=0; return; } var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z; var seen=false, nd=1e9;
 police.forEach(function(pc){ if(!pc.visible) return; var d=Math.hypot(px-pc.position.x,pz-pc.position.z); if(d<nd) nd=d; if(d<34&&(d<9||losClear(pc.position.x,pc.position.z,px,pz))) seen=true; }); /* TERLIHAT = dekat DAN garis pandang bebas gedung: bersembunyi di balik gedung kini benar-benar memutus jejak (versi lama hanya mengukur jarak, jadi wanted tidak pernah turun selama polisi berada < 34 unit walau terhalang gedung) */
 if(wanted>=4) roadblocks.forEach(function(rb){ if(!rb.visible) return; var d=Math.hypot(px-rb.position.x,pz-rb.position.z); if(d<nd) nd=d; }); /* jarak sirene ikut menghitung mobil roadblock di wanted 4–5 */
 footCops.forEach(function(fc){ if(!fc.mesh.visible) return; var d=Math.hypot(px-fc.mesh.position.x,pz-fc.mesh.position.z); if(d<nd) nd=d; if(d<30&&(d<8||losClear(fc.mesh.position.x,fc.mesh.position.z,px,pz))) seen=true; }); /* TAHAP 3: polisi jalan kaki juga bisa melihatmu (aturan sama: dekat + garis pandang bebas gedung) */
 if(polHeliOn&&policeHeli){ var hd=Math.hypot(px-policeHeli.g.position.x,pz-policeHeli.g.position.z); if(hd<46&&hd<nd) nd=hd; if(hd<11) seen=true; } /* TAHAP 3: selama lampu sorot helikopter polisi mengenaimu (kamu di bawah helinya), jejak TIDAK putus — wanted tidak akan luruh */
 if(seen){ hiddenT=0; if(inCar) lastSeenCar=inCar; }
 else { hiddenT+=dt; if(hiddenT>6) wanted=Math.max(0,wanted-dt*.13); /* jejak hilang > 6 dtk: wanted luruh ~1 bintang per 8 detik */ }
 if(AC&&wanted>=1&&nd<46){ sirenT-=dt; if(sirenT<=0){ sirenT=.42; sirenHi=!sirenHi; sfxSirenNote(sirenHi); } } /* SIRENE khusus dua nada (bus SFX), hanya bila polisi/roadblock dekat */ }
function updatePoliceActive(dt){ var tx=inCar?inCar.position.x:player.position.x, tz=inCar?inCar.position.z:player.position.z; police.forEach(function(pc,i){ if(!pc.visible) return; var u=pc.userData; if(u.angle==null) u.angle=pc.rotation.y; var dx=tx-pc.position.x, dz=tz-pc.position.z, d=Math.hypot(dx,dz);
 if(d>75){ var sp=roadSnap(tx+(i-1)*16,tz+24); pc.position.set(sp.x,0,sp.z); u.wp=null; u.angle=Math.atan2(tx-sp.x,tz-sp.z); pc.rotation.y=u.angle; return; } /* respawn pengejar jauh: mendarat DI BADAN JALAN (roadSnap), bukan di dalam gedung */
 var gx=tx, gz=tz;
 if(d>24||!losClear(pc.position.x,pc.position.z,tx,tz)){ if(!u.wp||Math.hypot(u.wp.x-pc.position.x,u.wp.z-pc.position.z)<5) u.wp=pickWp(pc.position.x,pc.position.z,tx,tz); if(u.wp){ gx=u.wp.x; gz=u.wp.z; } } else u.wp=null;
 var ta=Math.atan2(gx-pc.position.x,gz-pc.position.z), da=ta-u.angle; while(da>Math.PI)da-=Math.PI*2; while(da<-Math.PI)da+=Math.PI*2;
 var turn=Math.max(-2.4*dt,Math.min(2.4*dt,da)); u.angle+=turn; /* kemudi terbatas: belok mulus seperti mobil, tidak berputar di tempat */
 var spd=(wanted>=3?17.5:13.5)*(1-Math.min(.55,Math.abs(da)*.35));
 var pmx=Math.sin(u.angle)*spd*dt, pmz=Math.cos(u.angle)*spd*dt;
 if(!collide(pc.position.x+pmx,pc.position.z+pmz)){ pc.position.x+=pmx; pc.position.z+=pmz; } else if(!collide(pc.position.x+pmx,pc.position.z)){ pc.position.x+=pmx; } else if(!collide(pc.position.x,pc.position.z+pmz)){ pc.position.z+=pmz; } else { u.angle+=dt*2.8; u.wp=null; } /* mentok total: putar & cari waypoint baru — tidak tersangkut */
 pc.rotation.y=u.angle;
 /* ANTI-NYANGKUT: bila polisi bermaksud bergerak tapi posisi nyaris tidak berubah > 1,1 detik (mentok di sudut gedung / kendaraan), pindahkan ke titik jalan terdekat (roadSnap) dan bidik ulang pemain — polisi tidak pernah tersangkut permanen */
 if(u.lx==null){ u.lx=pc.position.x; u.lz=pc.position.z; u.stuckT=0; }
 u.stuckT+=dt;
 if(u.stuckT>1.1){ var moved=Math.hypot(pc.position.x-u.lx,pc.position.z-u.lz); if(moved<.6&&d>9){ var rs=roadSnap(pc.position.x,pc.position.z); pc.position.set(rs.x,0,rs.z); u.wp=null; u.angle=Math.atan2(tx-rs.x,tz-rs.z); pc.rotation.y=u.angle; } u.lx=pc.position.x; u.lz=pc.position.z; u.stuckT=0; }
 if(d<2.6){ health-=dt*7; if(health<=0){ money=Math.max(0,money-200); onPlayerDown("Kamu TERTANGKAP polisi! Denda -$200. Misi diulang dari checkpoint — progres misi yang sudah selesai tetap aman."); } } }); } /* tertangkap = respawn di tempat aman, progres misi TETAP */
/* ROADBLOCK — 2 mobil polisi melintang menutup jalan di depan pemain saat wanted 4–5 bintang.
   Posisinya ikut tercatat sebagai collider, jadi mobil pemain benar-benar tertahan (tabrakan biasa berlaku). */
var roadblocks=[], rbCols=[], rbPlaced=false, rbCx=0, rbCz=0, rbToastAt=0;
for(var rbi=0;rbi<2;rbi++){ var rbc=makeCar(0x14141f,true); rbc.visible=false; scene.add(rbc); roadblocks.push(rbc); }
function clearRoadblock(){ roadblocks.forEach(function(rb){ rb.visible=false; }); rbCols.forEach(function(cl){ var i=colliders.indexOf(cl); if(i>=0) colliders.splice(i,1); }); rbCols=[]; rbPlaced=false; }
function placeRoadblock(){ clearRoadblock(); var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z; var bx=ROADS[0],bz=ROADS[0],dx=1e9,dz=1e9; ROADS.forEach(function(r){ if(Math.abs(px-r)<dx){ dx=Math.abs(px-r); bx=r; } if(Math.abs(pz-r)<dz){ dz=Math.abs(pz-r); bz=r; } });
 var fa= inCar? inCar.userData.angle : playerAngle, fx=Math.sin(fa), fz=Math.cos(fa); if(inCar&&carSpeed<0){ fx=-fx; fz=-fz; }
 var cx,cz;
 if(dx<=dz){ cz=Math.max(-98,Math.min(98,pz+(fz>=0?1:-1)*27)); cx=bx; roadblocks[0].position.set(cx-3,0,cz); roadblocks[1].position.set(cx+3,0,cz); roadblocks.forEach(function(rb){ rb.rotation.y=Math.PI/2; rb.userData.angle=Math.PI/2; }); }
 else { cx=Math.max(-98,Math.min(98,px+(fx>=0?1:-1)*27)); cz=bz; roadblocks[0].position.set(cx,0,cz-3); roadblocks[1].position.set(cx,0,cz+3); roadblocks.forEach(function(rb){ rb.rotation.y=0; rb.userData.angle=0; }); }
 roadblocks.forEach(function(rb){ rb.visible=true; rbCols.push({x:rb.position.x,z:rb.position.z,r:3.4}); }); rbCols.forEach(function(cl){ colliders.push(cl); }); /* r=3,4 (bukan 2,8): kedua collider kini TUMPANG TINDIH di tengah (jarak antar mobil 6 < 3,4+3,4) — versi lama menyisakan celah 0,4 di titik tengah sehingga pemain/mobil bisa menyelinap lurus menembus roadblock */
 rbCx=roadblocks[0].position.x; rbCz=roadblocks[0].position.z; rbPlaced=true;
 if(performance.now()-rbToastAt>8000){ rbToastAt=performance.now(); toast("🚧 ROADBLOCK! Polisi menutup jalan di depanmu!"); if(AC) beep(196,.3,"square",.18); } }
function updateRoadblocks(){ if(wanted<4){ if(rbPlaced) clearRoadblock(); return; } var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z; if(!rbPlaced||Math.hypot(px-rbCx,pz-rbCz)>58) placeRoadblock(); roadblocks.forEach(function(rb){ if(rb.userData.bar) rb.userData.bar.material.color.setHex(Math.floor(performance.now()/280)%2?0xff2222:0x2266ff); }); }
/* ============ TAHAP 3 — POLISI JALAN KAKI & HELIKOPTER POLISI ============
   POLISI JALAN KAKI: pool TETAP 3 petugas dari makeOfficer() (dibuat sekali, tanpa objek baru per
   frame). Aktif mulai wanted 2★ (2 petugas), wanted 3★+ (3 petugas). Mereka mengejar dengan steering
   sederhana ala moveFoe (geser menyamping bila mentok gedung — tanpa pathfinding berat), lebih cepat
   dari jalan biasa pemain (5,6) tapi kalah dari lari sprint (8,5) dan mobil. Terlalu jauh (>72) ->
   muncul ulang di badan jalan dekat pemain, sama seperti mobil patroli. Petugas yang menempel pemain
   yang sedang jalan kaki / di mobil berhenti = MENANGKAP: health terkuras seperti ditangkap mobil
   patroli (hanya SATU petugas yang menguras per frame, tidak ditumpuk), lalu tertangkap = denda $200
   + ulangi misi dari checkpoint, progres misi tetap aman.
   HELIKOPTER POLISI: TERPISAH dari 2 heli hiasan — satu heli biru tua khusus (makeHeli dipakai ulang)
   + satu cakram cahaya sorot di tanah. Muncul di wanted 4–5★, melayang ~19 unit di atas pemain dan
   mengikutinya (kecepatan maks 24 — mobil ngebut penuh masih bisa meninggalkannya). Selama pemain
   berada di bawah sorotnya (jarak mendatar < 11), updateWanted menganggap pemain TERLIHAT: jejak
   tidak putus dan wanted tidak luruh, seberapa pun jauhnya polisi darat. Sirene, roadblock, dan
   aturan kehilangan jejak lainnya TIDAK diubah. */
var footCops=[], footToastAt=0;
for(var fci=0;fci<3;fci++){ var fom=makeOfficer(PED_SKINS[fci%PED_SKINS.length]); fom.visible=false; scene.add(fom); footCops.push({mesh:fom,active:false}); }
function moveOfficer(m,vx,vz,dt){ var mx=vx*dt, mz=vz*dt;
 if(!collide(m.position.x+mx,m.position.z+mz)){ m.position.x+=mx; m.position.z+=mz; return; }
 if(!collide(m.position.x+mx,m.position.z)){ m.position.x+=mx; return; }
 if(!collide(m.position.x,m.position.z+mz)){ m.position.z+=mz; return; }
 var sp=Math.hypot(vx,vz); if(sp<.1) return; var sx=-vz/sp*sp*dt, sz=vx/sp*sp*dt; /* mentok depan: geser menyamping, sama seperti steering musuh Azura */
 if(!collide(m.position.x+sx,m.position.z+sz)){ m.position.x+=sx; m.position.z+=sz; return; }
 if(!collide(m.position.x-sx,m.position.z-sz)){ m.position.x-=sx; m.position.z-=sz; } }
function updateFootPolice(dt){ var n= wanted>=3? 3 : (wanted>=2? 2 : 0);
 var tx=inCar?inCar.position.x:player.position.x, tz=inCar?inCar.position.z:player.position.z, grabbed=false;
 footCops.forEach(function(fc,i){ var m=fc.mesh;
  if(i>=n){ if(fc.active){ fc.active=false; m.visible=false; } return; }
  if(!fc.active){ fc.active=true; m.visible=true; var sp=roadSnap(tx+(i-1)*13, tz+(i%2? -17:17)); m.position.set(sp.x,0,sp.z); m.rotation.x=0; m.position.y=0;
   if(performance.now()-footToastAt>10000){ footToastAt=performance.now(); toast("🚔 Polisi jalan kaki dikerahkan untuk menangkapmu!"); if(AC) beep(196,.25,"square",.16); } }
  var dx=tx-m.position.x, dz=tz-m.position.z, d=Math.hypot(dx,dz);
  if(d>72){ var rsp=roadSnap(tx+(i-1)*13, tz+(i%2? -17:17)); m.position.set(rsp.x,0,rsp.z); dx=tx-m.position.x; dz=tz-m.position.z; d=Math.hypot(dx,dz); } /* pengejar tertinggal jauh: muncul ulang di badan jalan dekat pemain (seperti mobil patroli) */
  m.rotation.y=Math.atan2(dx,dz);
  if(d>2.4){ var spd=5.6; moveOfficer(m, dx/(d||1)*spd, dz/(d||1)*spd, dt); m.userData.walk+=dt*spd*2.2; poseWalk(m,1); }
  else { idlePose(m,performance.now());
   if(!grabbed&&(!inCar||Math.abs(carSpeed)<2)){ grabbed=true; health-=dt*6; /* MENANGKAP: menguras seperti mobil patroli, tidak ditumpuk antar petugas */
    if(health<=0){ money=Math.max(0,money-200); onPlayerDown("Kamu TERTANGKAP polisi jalan kaki! Denda -$200. Misi diulang dari checkpoint — progres misi yang sudah selesai tetap aman."); } } } }); }
var policeHeli=makeHeli(0x1d3461); policeHeli.g.visible=false; policeHeli.cone.scale.y=19/36; policeHeli.cone.position.y=-19/2-1; /* kerucut sorot disetel untuk ketinggian patroli 19 (heli hiasan tetap 24/31) */
var polHeliOn=false, polHeliToastAt=0;
var spotDisc=new THREE.Mesh(new THREE.CircleGeometry(7,20),new THREE.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false})); spotDisc.rotation.x=-Math.PI/2; spotDisc.position.y=.08; spotDisc.visible=false; scene.add(spotDisc); /* cakram cahaya sorot di tanah, tepat di bawah helikopter */
function updatePoliceHeli(dt,now){ var on=wanted>=4;
 if(!on){ if(polHeliOn){ polHeliOn=false; policeHeli.g.visible=false; spotDisc.visible=false; } return; }
 var tx=inCar?inCar.position.x:player.position.x, tz=inCar?inCar.position.z:player.position.z, g=policeHeli.g;
 if(!polHeliOn){ polHeliOn=true; g.visible=true; spotDisc.visible=true; g.position.set(tx,19,tz-16); /* datang dari belakang pemain */
  if(now-polHeliToastAt>10000){ polHeliToastAt=now; toast("🚁 Helikopter polisi mengawasimu! Selama lampu sorotnya mengenaimu, jejakmu tidak putus."); if(AC) beep(196,.3,"square",.16); } }
 var dx=tx-g.position.x, dz=tz-g.position.z, d=Math.hypot(dx,dz);
 if(d>.5){ var step=Math.min(d,24*dt); g.position.x+=dx/d*step; g.position.z+=dz/d*step; g.rotation.y=Math.atan2(dx,dz); } /* mengikuti pemain dari atas, maks 24 unit/dtk */
 g.position.y=19+Math.sin(now*.0012)*.8;
 policeHeli.rotor.rotation.y+=dt*26; policeHeli.tr.rotation.x+=dt*30;
 policeHeli.cone.material.opacity=.22; /* sorot selalu menyala selama patroli (siang & malam) */
 if(policeHeli.bl) policeHeli.bl.visible=Math.floor(now/450)%2===0;
 spotDisc.position.x=g.position.x; spotDisc.position.z=g.position.z; spotDisc.material.opacity=.13+Math.sin(now*.006)*.04; }
addEventListener("resize",function(){ camera.aspect=innerWidth/innerHeight; camera.fov=camera.aspect<1?72:62; /* SPEC 12:47: FOV potret (lihat sizeGL) */ camera.updateProjectionMatrix(); if(renderer) renderer.setSize(innerWidth,innerHeight); if(testCamA){ testCamA.aspect=camera.aspect; testCamA.updateProjectionMatrix(); } if(testCamB){ testCamB.aspect=camera.aspect; testCamB.updateProjectionMatrix(); } });
document.addEventListener("gesturestart",function(e){ e.preventDefault(); });
document.addEventListener("touchmove",function(e){ if(gameStarted&&!(e.target&&e.target.closest&&e.target.closest(".card"))) e.preventDefault(); },{passive:false}); /* sentuhan di dalam kartu modal (daftar toko dll.) TIDAK dicegah — di sanalah daftar harus bisa digulir; sisanya tetap dicegah supaya layar game tidak ikut bergeser */
setMission(); updateHUD(); loadSave(); startBoot(); /* loadSave SEBELUM menu dipakai: CONTINUE langsung aktif bila ada progres tersimpan dari sesi sebelumnya */

/* ============================================================================
   ROUND 9 — MODUL BARU: TAKSI SEJA + MODE FOTO + AMBIEN + SHOT STAGING
   Ditulis segar di sesi round 9, di dalam IIFE game supaya bisa memakai
   semua state & helper game (player, inCar, money, toast, scene, dll).
   - TAKSI SEJA: antar penumpang keliling kota naik mobil, dapat ongkos +
     tip waktu. Tombol 🚕 di baris mini atau tombol Y.
   - MODE FOTO: tombol P / 📸 menyembunyikan semua HUD & kontrol supaya
     bisa membingkai gambar bersih, lalu simpan canvas sebagai PNG.
   - AMBIEN: burung camar di atas pelabuhan/marina + perahu bergoyang di
     laut selatan kota (di luar pagar collider, murni pemandangan).
   - SHOT STAGING: ?shot=start|drive|chase|boss menata satu adegan utuh
     (jam, posisi, wanted, pesan HUD) setelah boot selesai, sesuai tabel
     adegan di src/shots.js. Tanpa ?shot=, permainan normal tak berubah.
   - WRAPPER animate(): loop asli tetap jalan apa adanya; modul ini hanya
     menempelkan tick-nya sendiri SETELAH tiap frame game selesai.
   ============================================================================ */

/* ---------- TAKSI SEJA ---------- */
var TAXI_SPOTS=[
 {n:"Dermaga",x:-52,z:52},{n:"Neon Strip",x:48,z:42},
 {n:"Taman Senja",x:-18,z:-54},{n:"Bukit Halcyon",x:52,z:-52},
 {n:"Marina",x:-52,z:-52},{n:"SPBU Seja",x:-54,z:-80},
 {n:"Bengkel Seja",x:54,z:80},{n:"Pantai Selatan",x:-8,z:96}
];
var taxi={active:false,phase:"",pickup:null,dest:null,timer:0,fare:0,done:0};
var taxiMarker=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,14,16,1,true),new THREE.MeshBasicMaterial({color:0x00e5ff,transparent:true,opacity:.45,side:THREE.DoubleSide}));
taxiMarker.visible=false; scene.add(taxiMarker);
var taxiPassenger=null;
var taxiInfoEl=null;
function r9TaxiInfoEl(){
 if(taxiInfoEl) return taxiInfoEl;
 var box=document.getElementById("missionBox");
 if(!box) return null;
 var d=document.createElement("div");
 d.id="taxiInfo"; box.appendChild(d); taxiInfoEl=d; return d;
}
function r9SetTaxiInfo(txt){
 var el=r9TaxiInfoEl(); if(!el) return;
 if(txt){ el.textContent=txt; el.classList.add("on"); }
 else { el.textContent=""; el.classList.remove("on"); }
}
function r9FmtTime(s){ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+":"+(s%60<10?"0":"")+(s%60); }
function r9TaxiCleanup(){
 taxi.active=false; taxi.phase=""; taxi.pickup=null; taxi.dest=null; taxi.timer=0; taxi.fare=0;
 taxiMarker.visible=false;
 if(taxiPassenger){ taxiPassenger.visible=false; }
 r9SetTaxiInfo("");
}
function r9CancelTaxi(silent){
 var was=taxi.active; r9TaxiCleanup();
 if(was&&!silent) toast("🚕 Taksi dibatalkan.");
}
function r9PickTaxiSpot(exclude){
 var spot=null, guard=0;
 do { spot=TAXI_SPOTS[Math.floor(Math.random()*TAXI_SPOTS.length)]; guard++; }
 while(exclude&&spot===exclude&&guard<16);
 return spot;
}
function r9StartTaxi(){
 if(!gameStarted||paused||dialogueActive||failShowing||gameFinished) return;
 if(inHouse){ toast("🚕 Keluar rumah dulu sebelum narik taksi."); return; }
 if(taxi.active){ r9CancelTaxi(false); return; }
 if(typeof side!=="undefined"&&side.active){ toast("🚕 Selesaikan misi sampingan dulu sebelum narik taksi."); return; }
 var a=r9PickTaxiSpot(null), b=r9PickTaxiSpot(a);
 var pa=findSafeNear(a.x,a.z), db=findSafeNear(b.x,b.z);
 taxi.active=true; taxi.phase="pickup";
 taxi.pickup={n:a.n,x:pa.x,z:pa.z}; taxi.dest={n:b.n,x:db.x,z:db.z};
 taxi.timer=0; taxi.fare=0;
 if(!taxiPassenger){ taxiPassenger=makePed(); scene.add(taxiPassenger); }
 taxiPassenger.visible=true;
 taxiPassenger.position.set(pa.x,0,pa.z);
 taxiPassenger.rotation.y=Math.random()*Math.PI*2;
 taxiMarker.visible=true;
 taxiMarker.position.set(pa.x,7,pa.z);
 centerMsg("🚕 TAKSI SEJA");
 toast("🚕 Penumpang menunggu di "+a.n+" (penanda cyan)! Jemput NAIK MOBIL.");
 if(AC) beep(880,.12,"sine",.16);
 if(navigator.vibrate) navigator.vibrate(50);
}
function r9CompleteTaxi(){
 var tip=Math.min(40,Math.floor(taxi.timer));
 var total=taxi.fare+tip;
 money+=total; taxi.done++;
 var nm=taxi.dest?taxi.dest.n:"tujuan";
 r9TaxiCleanup();
 centerMsg("🚕 ANTARAN SELESAI +$"+total);
 toast("🚕 Penumpang sampai di "+nm+"! Ongkos $"+taxi.fare+(tip>0?(" + tip waktu $"+tip):"")+" — narik lagi lewat tombol 🚕.");
 if(AC){ beep(880,.14,"sine",.16); setTimeout(function(){ if(AC) beep(1174,.18,"sine",.16); },130); }
 if(navigator.vibrate) navigator.vibrate(60);
 updateHUD(); persistSave();
}
function r9FailTaxi(reason){
 r9TaxiCleanup();
 centerMsg("🚕 TAKSI GAGAL");
 toast(reason);
 if(AC) beep(196,.25,"square",.16);
}
function r9UpdateTaxi(dt,now){
 if(!taxi.active) return;
 if(!gameStarted||failShowing||gameFinished||typeof paused!=="undefined"&&paused){ r9CancelTaxi(true); return; }
 taxiMarker.rotation.y+=dt*.8;
 var px=inCar?inCar.position.x:player.position.x;
 var pz=inCar?inCar.position.z:player.position.z;
 if(taxi.phase==="pickup"){
  if(taxiPassenger&&taxiPassenger.visible) idlePose(taxiPassenger,now);
  var d0=Math.hypot(px-taxi.pickup.x,pz-taxi.pickup.z);
  if(inCar&&d0<4.5){
   taxi.phase="drop";
   if(taxiPassenger) taxiPassenger.visible=false;
   var dd=Math.hypot(taxi.dest.x-taxi.pickup.x,taxi.dest.z-taxi.pickup.z);
   taxi.timer=Math.max(45,Math.round(dd/9)+25);
   taxi.fare=40+Math.round(dd*.8);
   taxiMarker.position.set(taxi.dest.x,7,taxi.dest.z);
   var chat=TAXI_CHATTER[Math.floor(Math.random()*TAXI_CHATTER.length)];
   toast("🚕 Penumpang naik! Antar ke "+taxi.dest.n+" sebelum waktu habis — ongkos $"+taxi.fare+" + tip. “"+chat+"”");
   if(AC) beep(660,.13,"sine",.16);
  } else {
   r9SetTaxiInfo("🚕 TAKSI — Jemput penumpang di "+taxi.pickup.n+(inCar?"":" • naik MOBIL dulu, penumpang butuh taksi!")+" • "+r9TaxiRank().n+" ($"+(taxi.earned||0)+")");
  }
  return;
 }
 /* phase drop: penumpang di dalam mobil, kejar waktu ke tujuan */
 taxi.timer-=dt;
 if(taxi.timer<=0){
  r9FailTaxi("⏱️ Waktu habis — penumpang turun di tengah jalan. Coba lagi lewat tombol 🚕.");
  return;
 }
 if(!inCar){
  r9SetTaxiInfo("🚕 TAKSI — Antar ke "+taxi.dest.n+" • ⏱️ "+r9FmtTime(taxi.timer)+" • naik mobil lagi, penumpang menunggu! • "+r9TaxiRank().n);
  return;
 }
 var d1=Math.hypot(px-taxi.dest.x,pz-taxi.dest.z);
 if(d1<6){ r9CompleteTaxi(); return; }
 r9SetTaxiInfo("🚕 TAKSI — Antar ke "+taxi.dest.n+" • ⏱️ "+r9FmtTime(taxi.timer)+" • ongkos $"+taxi.fare+" + tip • "+r9TaxiRank().n+r9TaxiRushNote());
}

/* ---------- MODE FOTO ---------- */
var photoOn=false, photoWasPaused=false;
function r9PhotoBarLabel(txt){
 var bar=document.getElementById("photoBar");
 if(!bar) return;
 var s=bar.querySelector("span");
 if(s) s.textContent=txt;
}
function r9EnterPhoto(){
 if(!gameStarted||photoOn) return;
 photoOn=true; photoWasPaused=paused; paused=true;
 document.body.classList.add("photo");
 r9PhotoBarLabel("📸 MODE FOTO — layar bersih, tekan P / ✕ untuk keluar");
}
function r9ExitPhoto(){
 if(!photoOn) return;
 photoOn=false;
 document.body.classList.remove("photo");
 paused=photoWasPaused;
 r9PhotoBarLabel("📸 MODE FOTO — layar bersih, tekan P / ✕ untuk keluar");
}
function r9TogglePhoto(){
 if(!gameStarted) return;
 if(photoOn) r9ExitPhoto(); else r9EnterPhoto();
}
function r9SnapPhoto(){
 if(!photoOn||!renderer) return;
 try{
  drawFrame(); /* render dulu dalam task yang sama supaya drawing buffer masih valid */
  var url=renderer.domElement.toDataURL("image/png");
  var a=document.createElement("a");
  a.href=url; a.download="kota-seja-foto.png";
  document.body.appendChild(a); a.click(); a.remove();
  r9PhotoBarLabel("📸 Foto tersimpan sebagai kota-seja-foto.png!");
  setTimeout(function(){ if(photoOn) r9PhotoBarLabel("📸 MODE FOTO — layar bersih, tekan P / ✕ untuk keluar"); },2200);
 }catch(e){
  r9PhotoBarLabel("⚠️ Foto gagal disimpan di browser ini.");
 }
}

/* ---------- AMBIEN: BURUNG CAMAR ---------- */
/* 8 camar di dua kawanan (pelabuhan & marina): dua sayap tipis yang
   mengepak, mengorbit pelan di ketinggian 24–34. Geometri & material
   dipakai bersama lewat cache boxGeo/lamMat — nol alokasi per frame. */
var gulls=[];
(function r9BuildGulls(){
 var wingGeo=boxGeo(.95,.04,.3), wingMat=lamMat(0xf5f7fa);
 var flocks=[{x:-52,z:52,n:5},{x:-52,z:-52,n:3}];
 flocks.forEach(function(f){
  for(var i=0;i<f.n;i++){
   var g=new THREE.Group();
   var wl=new THREE.Mesh(wingGeo,wingMat); wl.position.x=-.45; g.add(wl);
   var wr=new THREE.Mesh(wingGeo,wingMat); wr.position.x=.45; g.add(wr);
   var body=new THREE.Mesh(boxGeo(.5,.09,.22),wingMat); g.add(body);
   scene.add(g);
   gulls.push({g:g,wl:wl,wr:wr,cx:f.x,cz:f.z,r:8+Math.random()*10,
    h:24+Math.random()*10,sp:(.14+Math.random()*.2)*(Math.random()<.5?1:-1),
    ph:Math.random()*6.28,flap:5+Math.random()*2});
  }
 });
})();
function r9UpdateGulls(dt,now){
 var t=now*.001;
 for(var i=0;i<gulls.length;i++){
  var u=gulls[i]; u.ph+=u.sp*dt;
  var gx=u.cx+Math.cos(u.ph)*u.r, gz=u.cz+Math.sin(u.ph)*u.r;
  u.g.position.set(gx,u.h+Math.sin(t*.7+i*1.3)*1.2,gz);
  u.g.rotation.y=Math.atan2(-Math.sin(u.ph)*Math.sign(u.sp),Math.cos(u.ph)*Math.sign(u.sp))+Math.PI/2;
  var flap=Math.sin(t*u.flap+i)*.5;
  u.wl.rotation.z=.25+flap; u.wr.rotation.z=-.25-flap;
 }
}

/* ---------- AMBIEN: PERAHU DI LAUT SELATAN ---------- */
/* 4 perahu sederhana di atas bidang laut (y=-0.6, selatan kota, di luar
   pagar collider sehingga murni pemandangan): lambung + kabin + tiang +
   layar, bergoyang pelan mengikuti ombak dan hanyut perlahan. */
var boats=[];
(function r9BuildBoats(){
 var cols=[0xf2f4f6,0xe53935,0x1e88e5,0xffd166];
 var spots=[{x:-70,z:132},{x:-25,z:150},{x:20,z:138},{x:65,z:158}];
 spots.forEach(function(s,i){
  var g=new THREE.Group();
  var hull=new THREE.Mesh(boxGeo(3.4,.7,1.7),lamMat(cols[i])); hull.position.y=.35; g.add(hull);
  var cabin=new THREE.Mesh(boxGeo(1.4,.6,1.1),lamMat(0x8a5a3a)); cabin.position.set(-.4,.95,0); g.add(cabin);
  var mast=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,2.6,6),lamMat(0x5a3a22)); mast.position.set(.5,1.9,0); g.add(mast);
  var sail=new THREE.Mesh(boxGeo(.08,1.9,1.3),new THREE.MeshBasicMaterial({color:0xfff6e0,side:THREE.DoubleSide})); sail.position.set(.5,2.1,.35); g.add(sail);
  g.position.set(s.x,-.6,s.z);
  g.rotation.y=Math.random()*Math.PI*2;
  scene.add(g);
  boats.push({g:g,bx:s.x,ph:i*1.7});
 });
})();
function r9UpdateBoats(dt,now){
 var t=now*.001;
 for(var i=0;i<boats.length;i++){
  var b=boats[i];
  b.g.position.y=-.6+Math.sin(t*.8+b.ph)*.22;
  b.g.position.x=b.bx+Math.sin(t*.12+b.ph)*5;
  b.g.rotation.z=Math.sin(t*.6+b.ph)*.045;
  b.g.rotation.x=Math.sin(t*.5+b.ph*2)*.03;
 }
}

/* ---------- SHOT STAGING (?shot=start|drive|chase|boss) ---------- */
var r9ShotName=null;
try{ if(typeof window.KOTA_SEJA_SHOT_QUERY==="function") r9ShotName=window.KOTA_SEJA_SHOT_QUERY(); }catch(e){}
function r9ShotScene(name){
 try{ return (window.KOTA_SEJA_SHOTS||{})[name]||null; }catch(e){ return null; }
}
function r9SnapCamera(){
 /* Tempatkan kamera persis di posisi orbit yang diinginkan supaya shot
    pertama sudah terbingkai — loop utama hanya me-lerp dari sana. */
 var fx=inCar?inCar.position.x:player.position.x, fz=inCar?inCar.position.z:player.position.z, fy=inCar?1:1.6;
 var dist=inCar?12:9, hd=Math.cos(camPitch)*dist, vd=Math.max(.55,Math.sin(camPitch)*dist+1.1); /* SPEC 12:33: jarak snap kamera disamakan dengan loop utama (9/12) */
 camera.position.set(fx+Math.sin(camYaw)*hd,vd,fz+Math.cos(camYaw)*hd);
 camera.lookAt(fx,fy,fz);
}
function r9ApplyShot(name){
 var sc=r9ShotScene(name); if(!sc) return false;
 startGame(false);
 /* NEW GAME memunculkan tutorial misi 1 — tutup supaya shot tidak
    tertutup kartu tutorial dan game tidak tertahan di pause. */
 try{ endTutorial(); closeModals(); }catch(e){}
 if(typeof sc.mission==="number"){ missionIdx=sc.mission; setMission(); }
 if(typeof sc.clock==="number") clockT=sc.clock;
 if(typeof sc.money==="number") money=sc.money;
 if(typeof sc.wanted==="number") wanted=sc.wanted;
 if(sc.player){ player.position.set(sc.player.x,0,sc.player.z); playerAngle=0; player.rotation.y=0; }
 if(typeof sc.camYaw==="number") camYaw=sc.camYaw;
 if(typeof sc.camPitch==="number") camPitch=sc.camPitch;
 if(sc.weapon){
  var wi=weapons.indexOf(sc.weapon);
  if(wi>=0){ ownedWeapons[wi]=true; if(isGun(sc.weapon)) ammo[sc.weapon]=sc.ammo||12; weaponIdx=wi; refreshWeaponUI(); }
 }
 if(!sc.onFoot&&sc.car){
  var car=null;
  for(var i=0;i<cars.length;i++){ if(cars[i].userData.parked&&!cars[i].userData.burnt){ car=cars[i]; break; } }
  if(car){
   car.position.set(sc.car.x,0,sc.car.z);
   car.userData.angle=sc.car.angle; car.rotation.y=sc.car.angle;
   car.userData.parked=false;
   inCar=car; carSpeed=sc.car.speed||0;
   player.visible=false; player.position.copy(car.position);
   updateAB();
  }
 }
 if(sc.wanted>=1&&typeof police!=="undefined"){
  /* Parkir 3 mobil patroli di sekitar pemain supaya kejar-kejaran
     langsung terlihat; updatePoliceActive yang mengemudikan mereka. */
  var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z;
  var offs=[[0,-16],[0,-28],[0,18]]; /* di garis jalan YANG SAMA dengan pemain (belakang, belakang, depan) — dulu diagonal, mobil patroli bisa mendarat di dalam gedung */
  police.forEach(function(pc,i){
   var o=offs[i%offs.length];
   pc.position.set(px+o[0],0,pz+o[1]);
   pc.userData.angle=Math.atan2(px-pc.position.x,pz-pc.position.z);
   pc.rotation.y=pc.userData.angle;
  });
 }
 if(sc.onFoot&&typeof missions!=="undefined"&&missions[missionIdx]&&!sc.noFace){
  /* Jalan kaki: hadapkan pemain ke penanda misi dan letakkan kamera di
     belakangnya, supaya target + penanda merah masuk bingkai. */
  var mm=missions[missionIdx];
  var fa=Math.atan2(mm.x-player.position.x,mm.z-player.position.z);
  player.rotation.y=fa; playerAngle=fa; camYaw=fa+Math.PI;
 } else if(sc.noFace){
  /* SPEC 12:51: hadapkan pemain SEARAH kamera (membelakangi kamera, menghadap
     jalan utama di depan) — bukan ke penanda misi. */
  player.rotation.y=camYaw+Math.PI; playerAngle=camYaw+Math.PI;
 }
 if(sc.message) centerMsg(sc.message);
 updateHUD();
 r9SnapCamera();
 return true;
}

/* ---------- WRAPPER LOOP + TOMBOL + TOMBOL KEYBOARD ---------- */
var r9LastTick=0;
function r9Tick(){
 var now=performance.now();
 var dt=Math.min(.1,(now-r9LastTick)/1000||0);
 r9LastTick=now;
 if(!photoOn){
  r9UpdateTaxi(dt,now);
  r9UpdateGulls(dt,now);
  r9UpdateBoats(dt,now);
  r9UpdateLighthouse(dt,now);
  r9UpdateDistrict();
  r9UpdateSouthGulls(dt,now);
 }
 r9UpdateSignHalos(); /* halo plakat tetap menyala walau mode foto aktif — bagian dari scene */
 if(!r9ShotApplied&&r9ShotName){
  if(typeof boot!=="undefined"&&boot.done&&!gameStarted){
   r9ShotApplied=true;
   try{ r9ApplyShot(r9ShotName); }catch(e){ if(window.console&&console.error) console.error("[r9-shot] staging gagal:",(e&&e.message)||e); }
  }
 }
}
/* Loop asli tetap jalan apa adanya; modul ini hanya menempelkan tick-nya
   sendiri SETELAH tiap frame game selesai (termasuk di menu, supaya
   camar & perahu sudah bergerak di balik layar judul). */
var r9ShotApplied=false;
var r9OrigAnimate=animate;
animate=function(){ r9OrigAnimate(); r9Tick(); };

function r9MiniButton(id,label,aria){
 var wrap=document.querySelector("#touch .miniBtns");
 if(!wrap) return null;
 var b=document.createElement("button");
 b.id=id; b.type="button"; b.textContent=label; b.setAttribute("aria-label",aria);
 wrap.appendChild(b); return b;
}
var r9BtnTaxi=r9MiniButton("btnTaxi","🚕","Taksi Seja");
if(r9BtnTaxi) r9BtnTaxi.addEventListener("click",function(){ initAudio(); r9StartTaxi(); });
var r9BtnPhoto=r9MiniButton("btnPhoto","📸","Mode foto");
if(r9BtnPhoto) r9BtnPhoto.addEventListener("click",function(){ initAudio(); r9TogglePhoto(); });
var r9BtnSnap=document.getElementById("btnPhotoSnap");
if(r9BtnSnap) r9BtnSnap.addEventListener("click",function(){ r9SnapPhoto(); });
var r9BtnPhotoExit=document.getElementById("btnPhotoExit");
if(r9BtnPhotoExit) r9BtnPhotoExit.addEventListener("click",function(){ r9ExitPhoto(); });
addEventListener("keydown",function(e){
 if(e.repeat) return;
 if(e.code==="KeyY") r9StartTaxi();
 if(e.code==="KeyP") r9TogglePhoto();
});
/* Catat dua kontrol baru di modal Controls supaya pemain menemukannya. */
(function r9ControlsNote(){
 var grid=document.querySelector("#modalControls .grid2");
 if(!grid) return;
 var d1=document.createElement("div");
 d1.innerHTML="<b>🚕 Taksi (Y)</b> — Jemput penumpang di penanda cyan naik mobil, antar ke tujuan sebelum waktu habis untuk ongkos + tip.";
 grid.appendChild(d1);
 var d2=document.createElement("div");
 d2.innerHTML="<b>📸 Mode Foto (P)</b> — Sembunyikan semua HUD &amp; tombol untuk membingkai gambar bersih, lalu simpan sebagai PNG.";
 grid.appendChild(d2);
})();

/* ---------- MODE FOTO: FILTER WARNA ---------- */
/* Filter CSS di atas canvas WebGL (Normal / Hangat / Neon / Senja) — murni
   presentasi, tidak mengubah scene. Tombol 🎨 muncul di bar foto. */
var r9PhotoFilters=[
 {n:"Normal",css:""},
 {n:"Hangat",css:"sepia(.35) saturate(1.25) hue-rotate(-8deg)"},
 {n:"Neon",css:"saturate(1.6) contrast(1.12) hue-rotate(8deg)"},
 {n:"Senja",css:"sepia(.55) saturate(1.5) hue-rotate(-18deg) brightness(1.05)"},
 {n:"Mono",css:"grayscale(1) contrast(1.12)"}
];
var r9PhotoFilterIdx=0;
function r9ApplyPhotoFilter(){
 if(!renderer) return;
 var f=r9PhotoFilters[r9PhotoFilterIdx];
 renderer.domElement.style.filter=f.css;
 r9PhotoBarLabel("📸 MODE FOTO — filter: "+f.n+" • P / ✕ keluar");
}
function r9CyclePhotoFilter(){
 r9PhotoFilterIdx=(r9PhotoFilterIdx+1)%r9PhotoFilters.length;
 r9ApplyPhotoFilter();
}
(function r9PhotoFilterButton(){
 var bar=document.getElementById("photoBar");
 if(!bar) return;
 var b=document.createElement("button");
 b.id="btnPhotoFilter"; b.type="button"; b.textContent="🎨 FILTER";
 b.style.cssText="background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35)";
 bar.appendChild(b);
 b.addEventListener("click",function(){ r9CyclePhotoFilter(); });
})();
/* Keluar dari mode foto selalu mengembalikan filter ke Normal. */
var r9OrigExitPhoto=r9ExitPhoto;
r9ExitPhoto=function(){
 r9OrigExitPhoto();
 r9PhotoRestoreClock();
 r9PhotoFilterIdx=0;
 if(renderer) renderer.domElement.style.filter="";
};

/* ---------- TAKSI: PANGKAT + CELOTEH PENUMPANG ---------- */
var TAXI_RANKS=[
 {at:0,n:"Pemula",mult:1},
 {at:500,n:"Sopir Handal",mult:1.25},
 {at:1500,n:"Legenda Taksi",mult:1.5}
];
var TAXI_CHATTER=[
 "Buru-buru ya, saya ada janji!",
 "Jalannya lewat taman saja, lebih adem.",
 "Kota ini cantik sekali saat senja, ya?",
 "Dulu saya sopir juga, tapi pensiun.",
 "Tolong pelan-pelan di tikungan, saya mual.",
 "Antar saya ke dermaga, kapalnya hampir berangkat!",
 "Radio-nya boleh diganti? Saya suka Seja FM.",
 "Wah, mobilnya mulus — baru dicuci ya?"
];
taxi.earned=0; taxi.bestTip=0;
function r9TaxiRank(){
 var r=TAXI_RANKS[0];
 for(var i=0;i<TAXI_RANKS.length;i++){ if((taxi.earned||0)>=TAXI_RANKS[i].at) r=TAXI_RANKS[i]; }
 return r;
}
/* Bungkus penyelesaian taksi: ongkos dikali pangkat, total & tip terbaik
   dicatat, dan naik pangkat diumumkan dengan toast sendiri. */
var r9OrigCompleteTaxi=r9CompleteTaxi;
r9CompleteTaxi=function(){
 var before=r9TaxiRank();
 var tip=Math.min(40,Math.floor(taxi.timer));
 taxi.fare=Math.round(taxi.fare*r9TaxiFareMult()); /* pangkat × jam sibuk (17:00–19:00) */
 var total=taxi.fare+tip;
 r9OrigCompleteTaxi();
 taxi.earned=(taxi.earned||0)+total;
 if(tip>(taxi.bestTip||0)) taxi.bestTip=tip;
 var after=r9TaxiRank();
 if(after.at>before.at){
  toast("🏆 NAIK PANGKAT TAKSI: "+after.n+"! Ongkos kini ×"+after.mult+" — total penghasilan taksi $"+taxi.earned+".");
  if(AC){ beep(1046,.14,"sine",.16); setTimeout(function(){ if(AC) beep(1318,.2,"sine",.16); },140); }
 }
};

/* ---------- MERCUSUAR PELABUHAN ---------- */
/* Menara putih-merah di sudut dermaga (-66,66) dengan sorot berputar:
   redup di siang hari, terang di malam/senja. Murni pemandangan — bukan
   collider, jadi tidak pernah menghalangi pemain atau misi. */
var r9Beacon=null, r9BeaconBeam=null;
(function r9BuildLighthouse(){
 var g=new THREE.Group();
 var tower=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.6,11,10),lamMat(0xf2f4f6));
 tower.position.y=5.5; g.add(tower);
 var band1=new THREE.Mesh(new THREE.CylinderGeometry(1.28,1.38,1.6,10),lamMat(0xd23b2e)); band1.position.y=3; g.add(band1);
 var band2=new THREE.Mesh(new THREE.CylinderGeometry(1.18,1.28,1.6,10),lamMat(0xd23b2e)); band2.position.y=8; g.add(band2);
 var lamp=new THREE.Mesh(new THREE.SphereGeometry(.8,10,8),new THREE.MeshBasicMaterial({color:0xfff2b0})); lamp.position.y=11.4; g.add(lamp);
 var beam=new THREE.Mesh(new THREE.ConeGeometry(3.2,26,12,1,true),new THREE.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:.1,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
 beam.rotation.z=Math.PI/2; beam.position.set(13,11.4,0); g.add(beam);
 g.position.set(-66,0,66);
 scene.add(g);
 r9Beacon=g; r9BeaconBeam=beam;
})();
function r9UpdateLighthouse(dt,now){
 if(!r9Beacon||!r9BeaconBeam) return;
 r9Beacon.rotation.y+=dt*.5;
 var night=(clockT<5.5||clockT>18.2);
 r9BeaconBeam.material.opacity=night?.3:.07;
}

/* ---------- SUASANA PANTAI/KOTA RINGAN (SPEC 12:33) ---------- */
/* Payung kafe warna-warni + tenda toko kecil di strip pantai selatan (z 86–96, rumput
   bebas gedung & bebas badan jalan) dan etalase toko berpendar (kaca cyan muda) di lantai
   dasar gedung. Semua geometri/material DIBAGI, tanpa objek baru per frame, tanpa lampu
   tambahan per objek — sesuai batas performa spec. */
var r9UmbrellaPoleGeo=new THREE.CylinderGeometry(.07,.07,2.6,6);
var r9UmbrellaCanopyGeo=new THREE.ConeGeometry(1.9,.8,8);
var r9UmbrellaTableGeo=new THREE.CylinderGeometry(.55,.55,.08,10);
var r9UmbrellaPoleMat=lamMat(0x8a7a5a);
var r9UmbrellaCols=[0xff5252,0xffd166,0x00bfa5,0xff80ab,0xff9800,0x40c4ff];
var r9UmbrellaMats=r9UmbrellaCols.map(function(c){ return lamMat(c); });
var r9UmbrellaTableMat=lamMat(0xf2f4f6);
var r9UmbrellaSpots=[[-60,93],[-42,90],[-24,93],[0,96],[14,93],[30,90],[48,93],[66,90]];
(function r9BuildUmbrellas(){
 r9UmbrellaSpots.forEach(function(p,i){
  var g=new THREE.Group(); g.position.set(p[0],0,p[1]);
  var pole=new THREE.Mesh(r9UmbrellaPoleGeo,r9UmbrellaPoleMat); pole.position.y=1.3; g.add(pole);
  var can=new THREE.Mesh(r9UmbrellaCanopyGeo,r9UmbrellaMats[i%r9UmbrellaMats.length]); can.position.y=2.8; can.rotation.y=i*.7; g.add(can);
  var tab=new THREE.Mesh(r9UmbrellaTableGeo,r9UmbrellaTableMat); tab.position.y=.75; g.add(tab);
  scene.add(g);
 });
})();
var r9StallCounterGeo=new THREE.BoxGeometry(1.8,1,1);
var r9StallRoofGeo=new THREE.BoxGeometry(2.4,.08,1.8);
var r9StallPoleGeo=new THREE.CylinderGeometry(.05,.05,1.9,5);
var r9StallRoofMats=[lamMat(0xff5252),lamMat(0x40c4ff),lamMat(0xffd166)];
var r9StallCounterMat=lamMat(0xf2f4f6);
var r9StallPoleMat=lamMat(0x5a4a3a);
var r9StallSpots=[[-36,94],[-18,95],[22,94],[40,95]];
(function r9BuildStalls(){
 r9StallSpots.forEach(function(p,i){
  var g=new THREE.Group(); g.position.set(p[0],0,p[1]); g.rotation.y=(i%2? .3 : -.25);
  var c=new THREE.Mesh(r9StallCounterGeo,r9StallCounterMat); c.position.y=.5; g.add(c);
  [[-1,-.8],[1,-.8],[-1,.8],[1,.8]].forEach(function(q){
   var pole=new THREE.Mesh(r9StallPoleGeo,r9StallPoleMat); pole.position.set(q[0],.95,q[1]); g.add(pole);
  });
  var roof=new THREE.Mesh(r9StallRoofGeo,r9StallRoofMats[i%r9StallRoofMats.length]); roof.position.y=1.95; roof.rotation.x=.18; g.add(roof);
  scene.add(g);
 });
})();
/* Etalase berpendar: kaca cyan muda (MeshBasic, fog:false — selalu terang) di lantai dasar
   muka (+z) beberapa gedung toko/hotel/kaca, tepat di atas jendela yang digambar tekstur. */
var r9ShopWinGeo=new THREE.PlaneGeometry(2.6,1.4);
var r9ShopWinMat=new THREE.MeshBasicMaterial({color:0x9fe8f2,fog:false});
(function r9BuildShopWindows(){
 var n=0;
 for(var i=0;i<buildingRects.length&&n<10;i++){
  var b=buildingRects[i];
  if(b.k!=="shop"&&b.k!=="hotel"&&b.k!=="glass") continue;
  if(i%2!==0) continue;
  var w=new THREE.Mesh(r9ShopWinGeo,r9ShopWinMat);
  w.position.set(b.x+b.hw*.25,1.8,b.z+b.hd+.06);
  scene.add(w); n++;
 }
})();
/* Halo plakat: siang tipis, sore/malam lebih kuat (LED bingkai menyala). */
function r9UpdateSignHalos(){
 var s=(clockT<6||clockT>=19)?.36:(clockT>=17)?.26:.10;
 for(var i=0;i<r9SignHalos.length;i++) r9SignHalos[i].opacity=s;
}

/* ---------- M6: DISTRIK, SENJA FOTO, JAM SIBUK TAKSI, KURSI KAFE ---------- */
/* Nama distrik saat pemain masuk wilayah baru — kuadran kota (Pelabuhan barat
   daya, Neon Strip tenggara, Marina barat laut, Bukit Halcyon timur laut).
   Toast dibatasi 1x per 20 detik supaya tidak spam saat berkendara. */
function r9DistrictAt(x,z){
 if(x<0&&z>=0) return "Pelabuhan";
 if(x>=0&&z>=0) return "Neon Strip";
 if(x<0&&z<0) return "Marina";
 return "Bukit Halcyon";
}
var r9CurDistrict=null, r9DistrictToastAt=0;
function r9UpdateDistrict(){
 if(!gameStarted||paused||photoOn) return;
 var px=inCar?inCar.position.x:player.position.x, pz=inCar?inCar.position.z:player.position.z;
 var d=r9DistrictAt(px,pz);
 if(d===r9CurDistrict) return;
 r9CurDistrict=d;
 var now=performance.now();
 if(now-r9DistrictToastAt<20000) return;
 r9DistrictToastAt=now;
 toast("📍 "+d+" — "+(d==="Pelabuhan"?"Dermaga & mercusuar di barat daya.":d==="Neon Strip"?"Lampu neon & toko di selatan.":d==="Marina"?"Perahu & camar di barat laut.":"Bukit & vila di timur laut."));
}
/* Mode foto: lompat ke senja — satu ketukan memindahkan jam ke 18:15 supaya
   foto golden hour bisa diambil kapan pun; jam asal dikembalikan saat keluar
   dari mode foto (lihat wrapper r9ExitPhoto). */
var r9PhotoPrevClock=null;
function r9PhotoJumpSunset(){
 if(!photoOn) return;
 if(r9PhotoPrevClock===null) r9PhotoPrevClock=clockT;
 clockT=18.15;
 r9PhotoBarLabel("📸 MODE FOTO — senja 18:15 • P / ✕ keluar");
}
function r9PhotoRestoreClock(){
 if(r9PhotoPrevClock!==null){ clockT=r9PhotoPrevClock; r9PhotoPrevClock=null; }
}
(function r9PhotoSunsetButton(){
 var bar=document.getElementById("photoBar");
 if(!bar) return;
 var b=document.createElement("button");
 b.id="btnPhotoSunset"; b.type="button"; b.textContent="🌇 SENJA";
 b.style.cssText="background:rgba(255,166,77,.25);color:#fff;border:1px solid rgba(255,255,255,.35)";
 bar.appendChild(b);
 b.addEventListener("click",function(){ r9PhotoJumpSunset(); });
})();
/* Taksi jam sibuk: ongkos ×1,5 pada 17:00–19:00 (di atas pengali pangkat). */
function r9TaxiFareMult(){
 var m=r9TaxiRank().mult;
 if(clockT>=17&&clockT<19) m*=1.5;
 return m;
}
function r9TaxiRushNote(){ return (clockT>=17&&clockT<19)?" • JAM SIBUK ×1,5":""; }
/* Kursi kafe di bawah tiap payung — dudukan + sandaran + 1 kaki tengah,
   geometri & material DIBAGI, statis (tanpa objek baru per frame). */
var r9ChairSeatGeo=new THREE.BoxGeometry(.55,.08,.55);
var r9ChairBackGeo=new THREE.BoxGeometry(.55,.6,.08);
var r9ChairLegGeo=new THREE.CylinderGeometry(.05,.05,.45,5);
var r9ChairMat=lamMat(0xf2f4f6);
(function r9BuildChairs(){
 r9UmbrellaSpots.forEach(function(p,i){
  [[-1.15,0],[1.15,Math.PI]].forEach(function(q){
   var g=new THREE.Group(); g.position.set(p[0]+q[0],0,p[1]); g.rotation.y=q[1]+(i%2? .4 : -.3);
   var seat=new THREE.Mesh(r9ChairSeatGeo,r9ChairMat); seat.position.y=.45; g.add(seat);
   var back=new THREE.Mesh(r9ChairBackGeo,r9ChairMat); back.position.set(0,.75,-.26); g.add(back);
   var leg=new THREE.Mesh(r9ChairLegGeo,r9ChairMat); leg.position.y=.22; g.add(leg);
   scene.add(g);
  });
 });
})();
/* Kawanan camar ketiga di atas pantai selatan — memakai geometri & material
   bersama dari kawanan M2, terbang mengelilingi strip payung. */
var r9SouthGulls=[];
var r9SouthGullWingGeo=new THREE.BoxGeometry(1.4,.06,.5);
var r9SouthGullMat=new THREE.MeshLambertMaterial({color:0xffffff});
(function r9BuildSouthGulls(){
 for(var i=0;i<4;i++){
  var g=new THREE.Group();
  var b1=new THREE.Mesh(r9SouthGullWingGeo,r9SouthGullMat); b1.rotation.z=.5; g.add(b1);
  var b2=new THREE.Mesh(r9SouthGullWingGeo,r9SouthGullMat); b2.rotation.z=-.5; g.add(b2);
  g.position.set(-40+i*26,26+Math.random()*6,100);
  scene.add(g);
  r9SouthGulls.push({g:g,a:i*1.7,sp:.5+Math.random()*.4,ph:Math.random()*6});
 }
})();
function r9UpdateSouthGulls(dt,now){
 var t=now*.001;
 r9SouthGulls.forEach(function(u){
  u.a+=dt*u.sp*.22;
  u.g.position.set(-14+Math.cos(u.a)*38,27+Math.sin(t*.7+u.ph)*2.5,100+Math.sin(u.a)*7);
  u.g.rotation.y=Math.atan2(-Math.sin(u.a)*Math.sign(u.sp),Math.cos(u.a)*Math.sign(u.sp))+Math.PI/2;
  var fl=Math.sin(t*7+u.ph)*.55;
  u.g.children[0].rotation.z=.5+fl; u.g.children[1].rotation.z=-.5-fl;
 });
}

})();
