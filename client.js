window.__ModuleLoader__.load({
  id: '@local/beeapi-dashboard',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const panelId = 'local-beeapi-dashboard';
    const dictionaries = {
      zh: {showUsd:'点击显示美元余额',showCny:'点击显示人民币估算',rateLabel:'固定汇率（1 USD 对应人民币）',saveRate:'保存汇率',rmb:'约合人民币',rateHint:'固定汇率参考，不代表实时汇率或实际充值价格。',rateSaved:'汇率已保存',settingsTitle:'BeeAPI API 设置',configureHint:'请到「插件 → BeeAPI 余额」配置渠道或 API Key。',autoHint:'打开页面、每轮正常结束后及每10分钟自动刷新余额；短时间内的重复请求会合并。',title:'BeeAPI 余额',back:'返回聊天',refresh:'刷新余额',connect:'连接并查询',disconnect:'移除本地连接',key:'BeeAPI API Key',intro:'选择 DSH 已有的 BeeAPI 渠道，或手动提供 Key，通过官方只读接口查询账户余额。',privacy:'复用模式只保存渠道引用，每次查询使用该渠道当前 Key，不另存副本。Key 仅由本机宿主发送至 beeapi.dev，不会返回面板；手动模式使用 DSH 凭据服务保存。',disclaimer:'非官方插件 · 仅查询余额，不发起模型请求。',connected:'已连接',unconnected:'尚未连接',balance:'账户余额',updated:'最近更新',busy:'正在处理…',unknown:'尚无余额数据',failed:'操作失败，请检查网络、Key 或宿主插件是否已更新。',removeHint:'移除只清除本插件的连接，不会删除 DSH 渠道凭据，也不会撤销 BeeAPI Key。',stale:'刷新失败时保留上次余额，请留意更新时间。',confirm:'手动 Key 可能具有模型调用权限，请使用可撤销的 Key。验证成功后由 DSH 凭据服务保存。',loading:'正在读取连接状态…',mode:'连接方式',reuse:'复用已有渠道',manual:'手动输入 Key',channel:'BeeAPI 渠道',choose:'请选择渠道',empty:'没有可用的 BeeAPI 渠道。仅支持 HTTPS beeapi.dev 地址；聊天渠道需配置 API Key 环境凭据，生图渠道需配置 Key。',reload:'刷新渠道列表',source:'当前凭据来源',chat:'聊天',image:'生图',missing:'未配置凭据',reuseHint:'连接后仅绑定所选渠道；以后在 DSH 更换该渠道 Key，余额查询自动使用新值。'},
      en: {showUsd:'Click to show USD balance',showCny:'Click to show estimated CNY',rateLabel:'Fixed rate (CNY per USD)',saveRate:'Save exchange rate',rmb:'Approximate CNY',rateHint:'Fixed-rate estimate, not a live exchange rate or actual top-up price.',rateSaved:'Exchange rate saved',settingsTitle:'BeeAPI API settings',configureHint:'Configure a channel or API key in Plugins → BeeAPI balance.',autoHint:'Balance refreshes on page open, after each normally completed turn, and every 10 minutes; nearby requests are combined.',title:'BeeAPI balance',back:'Back to chat',refresh:'Refresh balance',connect:'Connect and query',disconnect:'Remove local connection',key:'BeeAPI API key',intro:'Select an existing DSH BeeAPI channel or enter a key to query the official read-only balance endpoint.',privacy:'Reuse stores only a channel reference and resolves its current key on each query. Keys stay on the local host and are sent only to beeapi.dev. Manual keys use DSH credential storage.',disclaimer:'Unofficial plugin · No model requests.',connected:'Connected',unconnected:'Not connected',balance:'Account balance',updated:'Last updated',busy:'Working…',unknown:'No balance data yet',failed:'Request failed. Check the network, key, or whether the host plugin has been updated.',removeHint:'Removal clears only this plugin’s connection. DSH channel credentials and BeeAPI keys remain unchanged.',stale:'On refresh errors the previous balance is retained. Check its timestamp.',confirm:'Manual keys may also allow model calls. Use a revocable key; DSH stores it only after validation.',loading:'Reading connection status…',mode:'Connection method',reuse:'Reuse existing channel',manual:'Enter a key',channel:'BeeAPI channel',choose:'Select a channel',empty:'No supported BeeAPI channel is available. HTTPS beeapi.dev is required; chat channels need an API key environment credential and image channels need a key.',reload:'Reload channels',source:'Current credential source',chat:'Chat',image:'Image',missing:'No credential configured',reuseHint:'Only the channel reference is saved. Key changes in DSH take effect on the next balance query.'}
    };
    function Icon({size=20}) {return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,'aria-hidden':true},h('rect',{x:3,y:4,width:18,height:16,rx:2}),h('path',{d:'M3 9h18M7 16v-3m5 3v-4m5 4v-2'}));}
    return {inject:['slots','locale','layout'],apply(ctx) {
      for (const [locale,dict] of Object.entries(dictionaries)) ctx.effect(()=>ctx.locale.register('@local/beeapi-dashboard',locale,dict));
      const t=ctx.locale.bind('@local/beeapi-dashboard');
      const balanceListeners = new Set();
      const publishBalance = value => { for (const listener of balanceListeners) listener(value); };
      function CompactBalance() {
        React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
        const [snapshot,setSnapshot]=React.useState(null);
        const [showUsd,setShowUsd]=React.useState(false);
        React.useEffect(()=>{
          const controller=new AbortController();let running=false,polling=false;
          const accept=value=>{if(!controller.signal.aborted)setSnapshot(value);};
          balanceListeners.add(accept);
          async function pollState(){
            if(polling||controller.signal.aborted||document.hidden)return;
            polling=true;
            try{const response=await fetch('/api/local-beeapi/state',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(response.ok){const state=await response.json();if(typeof state?.connected==='boolean')publishBalance(state);}}
            catch{}finally{polling=false;}
          }
          async function update(recheckAge=false){
            if(running||controller.signal.aborted||document.hidden)return;
            running=true;
            try {
              const options={credentials:'same-origin',cache:'no-store',signal:controller.signal};
              const response=await fetch('/api/local-beeapi/state',options);
              if(!response.ok)return;
              const state=await response.json();
              if(typeof state?.connected!=='boolean')return;
              publishBalance(state);
              if(state.connected&&(!recheckAge||!Number.isFinite(Date.parse(state.updatedAt))||Date.now()-Date.parse(state.updatedAt)>=600000||Date.now()<Date.parse(state.updatedAt))){
                const refreshed=await fetch('/api/local-beeapi/refresh',{...options,method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
                if(refreshed.ok){const result=await refreshed.json();if(typeof result?.connected==='boolean')publishBalance(result);}
              }
            } catch {} finally {running=false;}
          }
          update();const timer=setInterval(update,600000),pollTimer=setInterval(pollState,60000);
          const onVisible=()=>update(true);document.addEventListener('visibilitychange',onVisible);
          return ()=>{controller.abort();clearInterval(timer);clearInterval(pollTimer);document.removeEventListener('visibilitychange',onVisible);balanceListeners.delete(accept);};
        },[]);
        const amount=snapshot?.balance?.available,currency=String(snapshot?.balance?.currency||'').toUpperCase(),rate=Number(snapshot?.usdCnyRate??7);
        if(!snapshot?.connected||typeof amount!=='number'||!Number.isFinite(amount))return null;
        const canToggle=currency==='USD'&&Number.isFinite(rate)&&rate>0&&Number.isFinite(amount*rate);
        let text;
        if(canToggle)text=showUsd?'$'+amount.toFixed(2):'¥'+(amount*rate).toFixed(2);
        else if(currency==='CNY')text='¥'+amount.toFixed(2);
        else text=amount.toFixed(2)+(currency?' '+currency:'');
        const hint=canToggle?t(showUsd?'showCny':'showUsd'):'';
        return h(canToggle?'button':'span',{...(canToggle?{type:'button',onClick:()=>setShowUsd(value=>!value),'aria-pressed':showUsd}:{}),style:{display:'inline-flex',alignItems:'center',order:2,fontFamily:'inherit',fontSize:'11px',fontWeight:400,color:'var(--dsw-alias-label-secondary)',lineHeight:'16px',letterSpacing:'normal',whiteSpace:'nowrap',margin:0,padding:0,border:0,background:'transparent',...(canToggle?{cursor:'pointer'}:{})},title:t('balance')+' · '+t('rateHint')+(hint?' · '+hint:''),'aria-label':t('balance')+' '+text+(hint?' · '+hint:'')},text);
      }
      function Panel({settingsPage=false}) {
        React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
        const [state,setState]=React.useState(null),[key,setKey]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
        const [mode,setMode]=React.useState('reuse'),[channelId,setChannelId]=React.useState('');
        const [rate,setRate]=React.useState('7'),[rateNotice,setRateNotice]=React.useState('');
         React.useEffect(()=>{const accept=value=>setState(value);balanceListeners.add(accept);return ()=>balanceListeners.delete(accept);},[]);
         const active=React.useRef(null);
        React.useEffect(()=>{const controller=new AbortController();active.current=controller;load('state',undefined,controller.signal).then(result=>{if(!settingsPage&&result?.connected&&!controller.signal.aborted)return load('refresh',{},controller.signal);});return ()=>{controller.abort();active.current=null;};},[]);
        async function load(action,body,signal) {
          setBusy(true);setError('');setRateNotice('');
          try {
            const response=await fetch('/api/local-beeapi/'+action,{method:action==='state'?'GET':'POST',headers:action==='state'?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:signal||active.current?.signal,credentials:'same-origin',cache:'no-store'});
            let result;
            try { result=await response.json(); } catch { const failure=new Error('response'); failure.safeMessage=(t('back')==='返回聊天'?'宿主未返回 JSON，请重新打开 DSH。':'Host returned a non-JSON response. Reopen DSH.')+' [HTTP '+response.status+']';throw failure; }
              const zh= t('back')==='返回聊天';
              const messages={browser_auth_required:zh?'DSH 登录凭据无效或已过期，请从桌面应用重新打开此页面。':'DSH browser session expired. Reopen this page from the desktop app.',api_key_rejected:zh?'API Key 被拒绝或已失效，请检查 BeeAPI 的 Key。':'API key rejected or inactive.',upstream_timeout:zh?'BeeAPI 请求超时，请重试。':'BeeAPI request timed out.',upstream_network_error:zh?'本机无法连接 BeeAPI，请检查网络。':'Cannot reach BeeAPI from the local host.',invalid_usage_response:zh?'BeeAPI 返回的余额格式不符合官方接口约定。':'Unexpected BeeAPI balance response.',same_origin_required:zh?'请求来源校验失败，请重新打开 DSH 页面。':'Origin check failed. Reopen DSH.',owner_required:zh?'当前连接没有账户所有者权限。':'Owner access required.',account_not_connected:zh?'尚未连接渠道或 Key，请先连接。':'Connect a channel or API key first.'};
              Object.assign(messages, {credential_or_internal_error:zh?'DSH 本地凭据服务读写失败，并非 BeeAPI Key 被拒绝。':'DSH credential storage failed; this is not a BeeAPI key rejection.',upstream_request_failed:zh?'BeeAPI 服务返回失败，请稍后重试。':'BeeAPI service returned an error.',invalid_api_key:zh?'Key 格式不合法：请仅粘贴 Key，不要包含 Bearer 前缀或其他文字（最多512字符）。':'Invalid key format. Paste only the key, at most 512 characters.',api_key_required:zh?'请输入 API Key。':'Enter an API key.',operation_cancelled:zh?'操作已取消，请重试。':'Operation cancelled. Retry.',json_required:zh?'插件请求格式错误，请重新打开面板。':'Invalid plugin request format.',invalid_json:zh?'插件请求数据错误。':'Invalid plugin request data.',unexpected_field:zh?'插件版本的请求字段不兼容。':'Incompatible plugin request fields.',body_too_large:zh?'提交的数据过长。':'Request body too large.',upstream_response_too_large:zh?'BeeAPI 返回的数据过长，已安全拒绝。':'BeeAPI response too large.'});
              Object.assign(messages, {channel_changed:zh?'渠道地址或凭据引用已改变，请重新选择该渠道连接。':'Channel address or credential reference changed. Reconnect the channel.',channel_key_missing:zh?'所选渠道缺少可用 Key，请在 DSH 对应渠道设置中配置。':'This channel has no usable key. Configure it in DSH channel settings.',channel_not_found:zh?'所选渠道已删除或不再是受支持的 BeeAPI 渠道，请重新选择。':'Channel removed or unsupported.',channel_credentials_missing:zh?'所选渠道没有可用 Key，请先在 DSH 设置中配置。':'Configure a key for this channel in DSH settings.',channel_unavailable:zh?'渠道设置不可用，请刷新列表或使用手动模式。':'Channel settings unavailable.',invalid_channel:zh?'渠道引用无效，请重新选择。':'Invalid channel reference.',settings_unavailable:zh?'无法读取渠道设置，请刷新列表或使用手动模式。':'Cannot read channel settings.'});
             Object.assign(messages,{invalid_exchange_rate:zh?'汇率须为大于0且不超过10000的数字。':'Rate must be greater than 0 and at most 10000.',rate_save_failed:zh?'汇率保存失败，请重试。':'Could not save the exchange rate. Retry.'});
             if (!response.ok) {
               const known=Object.hasOwn(messages,result?.error)?result.error:'host_response_unrecognized';
              const failure=new Error('request'); failure.safeMessage=(messages[known]||t('failed'))+' ['+known+' / HTTP '+response.status+']'; throw failure;
            }
            if (!result || typeof result.connected!=='boolean') throw new Error('format');
            if (!active.current || active.current.signal.aborted) return;
            setState(result);publishBalance(result);if(action==='state'||action==='rate')setRate(String(result.usdCnyRate??7));if(action==='rate')setRateNotice(t('rateSaved'));if(result.connected)setKey('');if(result.error)setError(messages[result.error]||t('failed'));return result;
          } catch(e) {if(e.name!=='AbortError'&&active.current&&!active.current.signal.aborted)setError(e.safeMessage||t('failed'));}
          finally {if(active.current&&!active.current.signal.aborted)setBusy(false);}
        }
        const button=(label,action,disabled=false)=>h('button',{type:'button',className:'beeapi-control',disabled:(label==='back'?false:busy)||disabled,onClick:action},t(label));
        const value=state?.balance?.available;
         const fixedRate=Number(state?.usdCnyRate??7);
         const cny=typeof value==='number'&&Number.isFinite(value)&&String(state?.balance?.currency).toUpperCase()==='USD'&&Number.isFinite(fixedRate)&&fixedRate>0&&Number.isFinite(value*fixedRate)?(value*fixedRate).toFixed(2):null;
        return h('section',{className:'beeapi-page','aria-label':t(settingsPage?'settingsTitle':'title')},
          h('style',null,'.beeapi-page{height:100%;min-height:0;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit}.beeapi-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:16px 20px;border-bottom:1px solid var(--dsw-alias-border-l1)}.beeapi-toolbar h1{margin:0 auto 0 0;font-size:16px}.beeapi-content{max-width:760px;margin:0 auto;padding:24px 20px;line-height:1.7}.beeapi-card{padding:24px;margin:20px 0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}.beeapi-control,.beeapi-input{box-sizing:border-box;font:inherit;font-size:13px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}.beeapi-control{cursor:pointer;text-decoration:none;display:inline-block}.beeapi-control:hover{background:var(--dsw-alias-interactive-bg-hover)}.beeapi-control:disabled{opacity:.5;cursor:default}.beeapi-control:focus-visible,.beeapi-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.beeapi-input{display:block;width:100%;margin:8px 0 14px}.beeapi-muted{font-size:13px;color:var(--dsw-alias-label-secondary)}.beeapi-value{font-size:36px;font-weight:600;overflow-wrap:anywhere;margin:12px 0}.beeapi-actions{display:flex;gap:10px;flex-wrap:wrap}.beeapi-error{border:1px solid var(--dsw-alias-border-l1);padding:12px;border-radius:8px;overflow-wrap:anywhere}.beeapi-card h2{font-size:15px;margin:0}'),
          h('header',{className:'beeapi-toolbar'},h(Icon,{}),h('h1',null,t(settingsPage?'settingsTitle':'title')),button('back',()=>ctx.layout.selectPanel(null))),
          h('div',{className:'beeapi-content'},h('p',null,t(settingsPage?'intro':'autoHint')),error&&h('p',{role:'alert',className:'beeapi-error'},error),
            h('div',{'aria-live':'polite'},busy&&h('p',{role:'status'},t('busy')),state&&h('p',{className:'beeapi-muted'},t(state.connected?'connected':'unconnected'))),
             state?.connected && h('div',{className:'beeapi-card'},h('h2',null,t('balance')),h('p',{className:'beeapi-muted'},t('source')+': '+(state.source?.kind==='manual'?t('manual'):state.source?.label||t('unknown'))),h('div',{className:'beeapi-value','aria-live':'polite',role:'status'},typeof value==='number'?value+' '+(state.balance.currency||''):t('unknown')),cny!==null&&h('div',{'aria-live':'polite'},h('p',null,t('rmb')+'：¥'+cny),h('p',{className:'beeapi-muted'},'1 USD = '+fixedRate+' CNY · '+t('rateHint'))),state.updatedAt&&h('p',{className:'beeapi-muted'},t('updated')+': '+new Date(state.updatedAt).toLocaleString()),h('div',{className:'beeapi-actions'},settingsPage?button('disconnect',()=>load('disconnect',{})):button('refresh',()=>load('refresh',{}))),settingsPage&&h('p',{className:'beeapi-muted'},t('removeHint')),h('p',{className:'beeapi-muted'},t('stale'))),
             settingsPage && state ? h('form',{className:'beeapi-card',onSubmit:e=>{e.preventDefault();if(!busy&&(mode==='reuse'?channelId:key.trim()))load('connect',mode==='reuse'?{channelId}:{apiKey:key.trim()});}},
               h('label',{htmlFor:'beeapi-mode'},t('mode')),h('select',{id:'beeapi-mode',className:'beeapi-input',value:mode,disabled:busy,onChange:e=>{setMode(e.target.value);setKey('');}},h('option',{value:'reuse'},t('reuse')),h('option',{value:'manual'},t('manual'))),
               mode==='reuse'?h(React.Fragment,null,h('label',{htmlFor:'beeapi-channel'},t('channel')),h('select',{id:'beeapi-channel',className:'beeapi-input',value:channelId,disabled:busy,required:true,onChange:e=>setChannelId(e.target.value)},h('option',{value:''},t('choose')),...(state.channels||[]).map(c=>h('option',{key:c.id,value:c.id,disabled:!c.configured},'['+t(c.kind)+'] '+c.label+(!c.configured?' — '+t('missing'):'')))),!(state.channels||[]).length&&h('p',{className:'beeapi-muted'},t('empty')),h('p',{className:'beeapi-muted'},t('reuseHint')),button('reload',()=>load('state'))):h(React.Fragment,null,h('label',{htmlFor:'beeapi-key'},t('key')),h('input',{id:'beeapi-key',className:'beeapi-input',type:'password',value:key,onChange:e=>setKey(e.target.value),autoComplete:'off',spellCheck:false,required:true,maxLength:512,disabled:busy}),h('p',{className:'beeapi-muted'},t('confirm'))),
               h('button',{type:'submit',className:'beeapi-control',disabled:busy||(mode==='reuse'?!channelId||!(state.channels||[]).some(c=>c.id===channelId&&c.configured):!key.trim())},t('connect'))):!state&&!busy?button('reload',()=>load('state')):null,
             settingsPage&&state&&h('form',{className:'beeapi-card',onSubmit:e=>{e.preventDefault();if(!busy&&rate.trim()&&Number.isFinite(Number(rate))&&Number(rate)>0&&Number(rate)<=10000)load('rate',{usdCnyRate:Number(rate)});}},h('label',{htmlFor:'beeapi-rate'},t('rateLabel')),h('input',{id:'beeapi-rate',className:'beeapi-input',type:'number',min:'0',max:'10000',step:'any',required:true,value:rate,disabled:busy,onChange:e=>{setRate(e.target.value);setRateNotice('');}}),h('button',{type:'submit',className:'beeapi-control',disabled:busy||!rate.trim()||!Number.isFinite(Number(rate))||Number(rate)<=0||Number(rate)>10000},t('saveRate')),h('p',{className:'beeapi-muted'},t('rateHint')),rateNotice&&h('p',{role:'status'},rateNotice)),
              !settingsPage&&state&&!state.connected&&h('p',null,t('configureHint')),
            settingsPage&&h('p',{className:'beeapi-muted'},t('privacy')),h('p',{className:'beeapi-muted'},t('disclaimer'))));
      }
      ctx.slots.inject('conversation.composer.dock',()=>ctx.slots.register({name:'conversation.composer.dock',id:'beeapi-balance',order:2},CompactBalance));
      function PluginSettings({view}) {return view==='summary'?h('span',null,t('settingsTitle')):h(Panel,{settingsPage:true});}
      ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:'@local/beeapi-dashboard'},PluginSettings));
      ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:panelId},Panel));
    }};
  }
});
