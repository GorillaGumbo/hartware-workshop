import {loveApiData} from './love-api-data.js';
export const luaTarget=Object.freeze({love:'11.5',dialect:'Lua 5.1 common subset',preview:'Fengari / Lua 5.3',revision:loveApiData.revision});
const a=(name,type,description,def)=>({name,type,description,...(def!==undefined?{default:def}:{})});
const n=(name,description,def)=>a(name,'number',description,def);
const text=(name,description)=>a(name,'string',description);
const entries=new Map(loveApiData.entries.map(entry=>[entry.name,{...entry,status:'native',description:'Native LÖVE API. This API is not implemented in HärtWare’s browser preview.',url:'https://love2d.org/wiki/'+entry.name}]));
function preview(name,args,description,example,notes='',kind='function'){
 const original=entries.get(name)??{name,kind,variants:[]};
 entries.set(name,{...original,status:notes?'partial':'preview',description,example,notes,previewVariants:[{args,returns:name==='love.graphics.newFont'?[a('font','number','Preview font-size value.')]:original.variants[0]?.returns??[]}],kind});
}
preview('love.load',[],'Set up your game once at the start of each run.','function love.load()\n  print("Ready")\nend','The preview calls this without startup arguments.','callback');
preview('love.update',[n('dt','Seconds since the previous update.')],'Advance movement and other game state.','function love.update(dt)\n  x = x + 100 * dt\nend','The preview caps dt at 0.05 seconds.','callback');
preview('love.draw',[],'Draw the current frame.','function love.draw()\n  love.graphics.circle("fill", 100, 100, 20)\nend','','callback');
preview('love.keypressed',[a('key','KeyConstant','The pressed key, for example "space" or "left".')],'Respond once when a key becomes pressed.','function love.keypressed(key)\n  if key == "space" then print("Jump") end\nend','Preview supplies key only; no scancode or repeat argument. Very short taps between frames may be missed.','callback');
preview('love.mousepressed',[n('x','Horizontal position in Game coordinates.'),n('y','Vertical position in Game coordinates.'),n('button','1 = left, 2 = right, 3 = middle.'),a('istouch','boolean','True for a touch pointer.'),n('presses','Single press: 1.')],'Respond to a pointer press inside Game.','function love.mousepressed(x, y, button)\n  if button == 1 then lyd.audio.play("ui-click") end\nend','Positions follow the Game canvas size. Preview reports single presses only; mouse polling, wheel and release callbacks remain native-only.','callback');
preview('love.keyreleased',[a('key','KeyConstant','The released key.')],'Respond when a held key becomes released.','function love.keyreleased(key)\n  print(key)\nend','Preview supplies key only; no scancode argument.','callback');
preview('love.filesystem.load',[text('filename','A Lua filename from Project → Scripts.')],'Compile a project Lua file without running it.','local chunk = assert(love.filesystem.load("main.lua"))','Only project Lua files are readable; no disk, network or native modules. Calling the returned chunk executes it again.');
entries.set('require',{name:'require',kind:'function',variants:[],status:'partial',description:'Load a Lua module from Project → Scripts once per Game run.',notes:'Use the filename without .lua. Project folders are organizational; dotted require names follow native path semantics and do not match dotted flat filenames. No native libraries, package table, disk or network searchers are exposed. Circular module loads report an error.',previewVariants:[{args:[text('moduleName','A project Lua module name without the .lua extension.')],returns:[a('module','any','The returned module value, or true for a module without a return value.')]}],example:'local module = require("module")'});
preview('love.graphics.newImage',[text('filename','An image filename from Project → Images.')],'Load an imported image.','local player = love.graphics.newImage("player.png")','Only imported filenames are supported; ImageData and settings overloads are unavailable.');
preview('love.graphics.draw',[a('image','Image','An image returned by love.graphics.newImage.'),n('x','Horizontal position.',0),n('y','Vertical position.',0),n('r','Rotation in radians.',0),n('sx','Horizontal scale.',1),n('sy','Vertical scale.',1)],'Draw an image at a position, with optional rotation and scale.','love.graphics.draw(player, 160, 240)','Only Image drawing is supported; origins, shear, Quads and other Drawable types are unavailable.');
preview('love.graphics.rectangle',[a('mode','DrawMode','Use "fill" or "line".'),n('x','Left edge.'),n('y','Top edge.'),n('width','Rectangle width.'),n('height','Rectangle height.')],'Draw a filled or outlined rectangle.','love.graphics.rectangle("fill", 20, 20, 80, 40)','Rounded corners are unavailable.');
preview('love.graphics.circle',[a('mode','DrawMode','Use "fill" or "line".'),n('x','Centre x coordinate.'),n('y','Centre y coordinate.'),n('radius','Circle radius.')],'Draw a filled or outlined circle.','love.graphics.circle("fill", 100, 100, 20)','The preview chooses its own segment count.');
preview('love.graphics.line',[n('x1','First point x.'),n('y1','First point y.'),n('x2','Second point x.'),n('y2','Second point y.'),a('...','number','Additional x, y pairs.')],'Draw connected line segments.','love.graphics.line(10, 10, 40, 50)','Only numeric coordinate arguments are supported; the table overload is unavailable.');
preview('love.graphics.print',[text('text','Text to display.'),n('x','Left position.',0),n('y','Top position.',0)],'Draw text using the current colour and preview font.','love.graphics.print("Hello", 20, 20)','Only plain text and x/y are supported; transforms, coloured text and native font metrics are unavailable.');
preview('love.graphics.setColor',[n('r','Red, from 0 to 1.'),n('g','Green, from 0 to 1.'),n('b','Blue, from 0 to 1.'),n('a','Opacity, from 0 to 1.',1)],'Set the colour used by subsequent drawing commands.','love.graphics.setColor(1, 0.5, 0.2, 1)','Only numeric arguments are supported; the colour-table overload is unavailable.');
preview('love.graphics.setBackgroundColor',[n('r','Red, from 0 to 1.'),n('g','Green, from 0 to 1.'),n('b','Blue, from 0 to 1.'),n('a','Opacity, from 0 to 1.',1)],'Set the background colour for the preview.','love.graphics.setBackgroundColor(0.1, 0.1, 0.15)','Only numeric arguments are supported.');
preview('love.graphics.getWidth',[],'Read the configured game width in pixels.','local width = love.graphics.getWidth()');
preview('love.graphics.getHeight',[],'Read the configured game height in pixels.','local height = love.graphics.getHeight()');
preview('love.graphics.newFont',[n('size','Font size in pixels.',18)],'Choose a size for the browser preview’s system font.','local font = love.graphics.newFont(24)','The preview returns a size value, not a native Font object; font files and Font methods are unavailable.');
preview('love.graphics.setFont',[a('font','Font','The value returned by love.graphics.newFont.')],'Use a font size for subsequent preview text.','love.graphics.setFont(love.graphics.newFont(24))','The preview uses a system font and does not reproduce native font metrics.');
preview('Image:getWidth',[],'Read the imported image width in pixels.','local width = player:getWidth()','','method');
preview('Image:getHeight',[],'Read the imported image height in pixels.','local height = player:getHeight()','','method');
preview('love.keyboard.isDown',[a('key','KeyConstant','A key such as "left", "right" or "space".'),a('...','KeyConstant','Additional keys; true if any is held.')],'Check whether one or more keys are held.','if love.keyboard.isDown("right") then x = x + 1 end','Click the Game preview to give it keyboard focus.');
preview('love.timer.getDelta',[],'Read the preview’s placeholder delta value.','local dt = love.timer.getDelta()','Currently always returns 1/60. Use love.update(dt) for movement timing.');
preview('love.timer.getFPS',[],'Read the preview’s placeholder frame rate.','local fps = love.timer.getFPS()','Currently always returns 60; this is not a measured frame rate.');
preview('lyd.audio.play',[text('eventName','An exact Event name from Project → Events.'),a('options','table','Optional volumeDb, fadeIn and fadeOut overrides.','nil')],'Play an authored Event, including its connected modules.','lyd.audio.play("jump", {volumeDb = -6})','HärtWare extension. Not part of native love.audio and not included in game export. Fades accept false or {duration = seconds, speed = "fast"|"medium"|"slow", curve = "straight"|"rounded"|"smooth"}; duration and speed are alternatives.');
preview('lyd.audio.stop',[text('eventName','The exact Event name to stop.')],'Stop an Event through its connected fade-out, or cancel its pending start.','lyd.audio.stop("ambiance")','HärtWare extension. Game Stop/Restart immediately cuts all game-owned Events. Not included in game export.');
// Preview math uses the LÖVE 11.5 RNG algorithm, with explicit integer domains.
const rngArguments={seed:'Integer seed from 0 to 2^53 − 1.',low:'Lower 32 seed bits, from 0 to 2^32 − 1.',high:'Upper 32 seed bits, from 0 to 2^32 − 1.',min:'Inclusive integer lower bound.',max:'Inclusive integer upper bound; a single bound starts at 1.',stddev:'Standard deviation, default 1.',mean:'Mean, default 0.',state:'An opaque state string returned by getRandomState or getState.'};
function mathPreview(name,description,example,notes=''){
 const original=entries.get(name);preview(name,[],description,example,notes,original.kind);
 entries.get(name).previewVariants=original.variants.map(v=>({...v,args:v.args.map(arg=>({...arg,description:rngArguments[arg.name]??''}))}));
}
mathPreview('love.math.random','Generate a uniform number in [0, 1), or an integer within inclusive bounds.','local x = love.math.random(0, 800)');
mathPreview('love.math.randomNormal','Generate a normally distributed value with optional deviation and mean.','local offset = love.math.randomNormal(10, 0)');
mathPreview('love.math.setRandomSeed','Start a repeatable random sequence from an integer seed or low/high pair.','love.math.setRandomSeed(42)');
mathPreview('love.math.getRandomSeed','Read the current seed as two unsigned 32-bit numbers.','local low, high = love.math.getRandomSeed()');
mathPreview('love.math.getRandomState','Read the generator state for a later restore.','local state = love.math.getRandomState()');
mathPreview('love.math.setRandomState','Restore a saved random state; resets the cached normal sample.','local state = love.math.getRandomState()\nlove.math.setRandomState(state)');
mathPreview('love.math.newRandomGenerator','Create an independent random generator, optionally seeded.','local rng = love.math.newRandomGenerator(42)\nlocal x = rng:random(0, 800)','The preview supports random, randomNormal, setSeed/getSeed and setState/getState. Its receiver is a Lua table; native userdata identity and Object methods are unavailable. With no seed it uses LÖVE 11.5’s fixed constructor seed.');
for(const [method,description,call] of [
 ['random','Generate a uniform value or an integer within inclusive bounds.','local value = rng:random(1, 6)'],
 ['randomNormal','Generate a normal sample using this generator.','local value = rng:randomNormal(2, 10)'],
 ['setSeed','Restart this independent generator from a seed.','rng:setSeed(42)'],
 ['getSeed','Read this generator’s low and high seed words.','local low, high = rng:getSeed()'],
 ['getState','Read this generator’s opaque state string.','local state = rng:getState()'],
 ['setState','Restore a state string and clear the normal-sample cache.','local state = rng:getState()\nrng:setState(state)']
])mathPreview('RandomGenerator:'+method,description,'local rng = love.math.newRandomGenerator(42)\n'+call);
for(const name of ['love','lyd','lyd.audio'])if(!entries.has(name))entries.set(name,{name,kind:'module',variants:[],status:'preview',description:name==='love'?'LÖVE game callbacks and modules.':'HärtWare’s project-specific extensions.'});
for(const entry of entries.values())if(entry.kind==='module'){
 const children=[...entries.values()].filter(e=>e.name.startsWith(entry.name+'.'));
 if(children.some(e=>e.status!=='native')){entry.status=children.some(e=>e.status==='native')?'partial':'preview';if(!entry.name.startsWith('lyd'))entry.description='LÖVE API module. Members are labelled by browser-preview support; native-only members need native LÖVE.';}
}
export const apiEntries=Object.freeze([...entries.values()]);
export const apiEntry=name=>entries.get(name);
export const previewEntries=apiEntries.filter(e=>e.status!=='native');
export const apiEnums=loveApiData.enums;
export const variantsFor=entry=>entry.previewVariants??entry.variants;
export const variantForArgument=(entry,index)=>variantsFor(entry).find(v=>v.args.length>index||v.args.at(-1)?.name==='...')??variantsFor(entry).at(-1);
export const statusLabel=entry=>entry.name.startsWith('lyd')?'HärtWare extension':entry.status==='native'?'Native only':entry.status==='partial'?'Preview · limited':'Preview';
export function signature(entry,variant=variantsFor(entry)[0]){const result=entry.name+(entry.kind==='module'?'':`(${(variant?.args??[]).map(a=>a.name+(a.default!==undefined?' = '+a.default:'')).join(', ')})`),returns=(variant?.returns??[]).map(a=>a.name+': '+a.type).join(', ');return result+(returns?' → '+returns:'');}
