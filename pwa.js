// The browser owns installation; prompts are shown only after an explicit click.
window.QuolingoInstall=(()=>{
  const display=matchMedia('(display-mode: standalone)');
  let deferred=null,busy=false,installed=display.matches||navigator.standalone===true,message='';
  const changed=()=>document.dispatchEvent(new Event('quolingo:install-state'));
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;changed();});
  window.addEventListener('appinstalled',()=>{installed=true;deferred=null;message='설치했어요. 홈 화면이나 바탕화면에서 Quolingo를 열어 보세요.';changed();});
  display.addEventListener('change',()=>{installed=display.matches||navigator.standalone===true;changed();});
  function html() {
    const status=installed?'installed':deferred?'available':'idle';
    return `<div class="install-heading"><img src="assets/app-icon-192.png" width="68" height="68" alt="함께 있는 코, 뮤니, 타스"><div><h2>Quolingo 앱</h2><p>홈 화면이나 바탕화면에서 바로 열어 보세요.</p></div></div><button type="button" class="primary" data-action="install-app" data-install-status="${status}" ${installed?'hidden':''} ${busy?'disabled':''}>${busy?'설치 창 여는 중':deferred?'앱 설치':'설치 및 바로가기'}</button><p class="install-status" role="status">${message||(installed?'설치한 Quolingo를 사용하고 있어요.':'Chrome에서 설치하거나 바로가기를 만들 수 있어요.')}</p><details class="install-help"><summary>설치 및 바로가기 만드는 방법</summary><p><strong>컴퓨터 Chrome</strong><br>주소창 오른쪽의 설치 아이콘을 누르세요. 바로가기는 ⋮ 메뉴 → 전송, 저장 및 공유 → 바로가기 만들기에서 만들 수 있어요.</p><p><strong>Android Chrome</strong><br>⋮ 메뉴 → 홈 화면에 추가 → 설치를 선택하세요.</p><p><strong>iPhone · iPad</strong><br>공유 메뉴에서 홈 화면에 추가를 선택하세요.</p></details>`;
  }
  async function request() {
    if(busy||installed)return;
    if(!deferred){const help=document.querySelector('.install-help');if(help){help.open=true;help.querySelector('summary').focus({preventScroll:true});help.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}return;}
    const prompt=deferred;deferred=null;busy=true;changed();
    try {
      await prompt.prompt();const choice=await prompt.userChoice;
      message=choice.outcome==='accepted'?'설치 요청을 보냈어요.':'설치를 취소했어요. 나중에 다시 설치할 수 있어요.';
    }catch{message='Chrome 메뉴의 앱 설치 또는 바로가기 만들기를 이용해 주세요.';}
    finally{busy=false;changed();}
  }
  if('serviceWorker' in navigator&&window.isSecureContext)window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>{/* Installation help remains usable. */});
  });
  return {html,request};
})();
