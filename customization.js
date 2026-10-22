// Existing item prices stay stable; a different price requires a new item id.
// Saved ownership never supplies its own price.
const QuolingoDecor = (() => {
  const items = [
    {id:'meadow',category:'background',name:'꽃 피는 정원',price:80},
    {id:'sunset',category:'background',name:'노을 들판',price:100},
    {id:'starlight',category:'background',name:'별빛 밤',price:140},
    {id:'ribbon',category:'accessory',name:'분홍 리본',price:45},
    {id:'flower',category:'accessory',name:'꽃 머리핀',price:55},
    {id:'star',category:'accessory',name:'반짝 별 배지',price:65},
    {id:'leaves',category:'frame',name:'새싹 테두리',price:55},
    {id:'sparkle',category:'frame',name:'별빛 테두리',price:75}
  ].map(Object.freeze);
  const catalog = new Map(items.map(item=>[item.id,item]));
  const slots = {background:'background',muni:'accessory',ko:'accessory',tas:'accessory',frame:'frame'};
  function normalize(value={}) {
    const owned=Object.fromEntries(items.filter(item=>value?.owned?.[item.id]===true).map(item=>[item.id,true]));
    const equipped=Object.fromEntries(Object.entries(slots).map(([slot,category])=>{
      const id=value?.equipped?.[slot];
      return [slot,owned[id]&&catalog.get(id)?.category===category?id:''];
    }));
    return {owned,equipped};
  }
  function spent(value) {return Object.keys(normalize(value).owned).reduce((sum,id)=>sum+catalog.get(id).price,0);}
  function balance(earned,value) {return Math.max(0,Math.floor(Number(earned)||0)-spent(value));}
  function equip(value,slot,id='') {
    const state=normalize(value);
    if(!Object.hasOwn(slots,slot)||id&&(!state.owned[id]||catalog.get(id)?.category!==slots[slot]))return null;
    state.equipped[slot]=id;return state;
  }
  function purchase(value,id,earned,slot) {
    const state=normalize(value),item=catalog.get(id);
    if(!item||slots[slot]!==item.category)return {ok:false,reason:'invalid'};
    if(state.owned[id])return {ok:false,reason:'owned'};
    if(balance(earned,state)<item.price)return {ok:false,reason:'balance'};
    state.owned[id]=true;state.equipped[slot]=id;
    return {ok:true,value:state};
  }
  // Preview can show an unowned item, but this value must never be saved directly.
  function preview(value,slot,id) {
    const state=normalize(value);
    if(Object.hasOwn(slots,slot)&&(!id||catalog.get(id)?.category===slots[slot]))state.equipped[slot]=id;
    return state;
  }
  return {items:Object.freeze(items),normalize,spent,balance,equip,purchase,preview};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=QuolingoDecor;
