-- In Audio: create the Event "jump" and load a file in Sound.
-- Return to main.lua, paste this demo, Run, then click Game.
-- Press Space. Holding it fires once; release and press to restart.
function love.keypressed(key)
  if key == "space" then
    lyd.audio.play("jump")
  end
end

function love.draw()
  love.graphics.print("Press Space to play jump", 24, 24)
end
