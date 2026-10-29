/**
 * Copyright (c) 2006-2023 LOVE Development Team
 *
 * This software is provided 'as-is', without any express or implied
 * warranty.  In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 * 1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 * 2. Altered source versions must be plainly marked as such, and must not be
 *    misrepresented as being the original software.
 * 3. This notice may not be removed or altered from any source distribution.
 */
// Altered version: JavaScript port of LÖVE 11.5 RandomGenerator.cpp/.h.
// Bounds and seeds are validated against the documented integer domains.
// No host Math.random state or audio random state is used.
(()=>{
 const mask=(1n<<64n)-1n,word=1n<<32n;
 const u64=n=>n&mask;
 function hash(key){
  key=u64((~key)+(key<<21n));key^=key>>24n;
  key=u64(key+(key<<3n)+(key<<8n));key^=key>>14n;
  key=u64(key+(key<<2n)+(key<<4n));key^=key>>28n;
  return u64(key+(key<<31n));
 }
 function integer(value,max,label,min=0){
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)throw Error(label+' must be an integer from '+min+' to '+max+'.');return value;
 }
 class RandomGenerator{
  constructor(low,high){if(low===undefined){low=0xCBBF7A44;high=0x0139408D;}this.setSeed(low,high);}
  setSeed(low,high){
   const seed=high===undefined?BigInt(integer(low,Number.MAX_SAFE_INTEGER,'Random seed')):BigInt(integer(high,0xffffffff,'High seed'))*word+BigInt(integer(low,0xffffffff,'Low seed'));
   this.seed=seed;this.state=hash(seed);if(this.state===0n)this.state=hash(0n);this.normalCache=null;
  }
  getSeed(){return [Number(this.seed&(word-1n)),Number(this.seed>>32n)];}
  uniform(){
   let state=this.state;state^=state>>12n;state^=u64(state<<25n);state^=state>>27n;this.state=state;
   return Number(u64(state*2685821657736338717n)>>12n)/4503599627370496;
  }
  random(low,high){
   if(low===undefined&&high===undefined)return this.uniform();
   if(high===undefined){high=low;low=1;}
   integer(low,Number.MAX_SAFE_INTEGER,'Lower bound',-Number.MAX_SAFE_INTEGER);integer(high,Number.MAX_SAFE_INTEGER,'Upper bound',-Number.MAX_SAFE_INTEGER);
   if(high<low||!Number.isSafeInteger(high-low+1))throw Error('Random bounds must form a nonempty safe integer interval.');
   return Math.floor(this.uniform()*(high-low+1))+low;
  }
  randomNormal(stddev=1,mean=0){
   if(typeof stddev!=='number'||!Number.isFinite(stddev)||typeof mean!=='number'||!Number.isFinite(mean))throw Error('randomNormal needs finite numeric deviation and mean.');
   if(this.normalCache!==null){const value=this.normalCache;this.normalCache=null;return value*stddev+mean;}
   const r=Math.sqrt(-2*Math.log(1-this.uniform())),phi=2*Math.PI*(1-this.uniform());
   this.normalCache=r*Math.cos(phi);return r*Math.sin(phi)*stddev+mean;
  }
  getState(){return '0x'+this.state.toString(16).padStart(16,'0');}
  setState(value){
   if(typeof value!=='string'||!/^0x[\da-fA-F]{1,16}$/.test(value))throw Error('Invalid random state; use a value from getRandomState/getState.');
   this.state=BigInt(value);this.normalCache=null;
  }
 }
 self.LovelyMath=Object.freeze({RandomGenerator});
})();
