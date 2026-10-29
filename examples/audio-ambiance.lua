-- Create Events named "ambiance" and "jump", then load their Sound files.
-- Set ambiance's Repeat to Forever. Enable its output Shape for a release.
function love.load()
  lyd.audio.play("ambiance", {volumeDb = -12})
end

function love.keypressed(key)
  if key == "space" then
    lyd.audio.play("jump")
  elseif key == "s" then
    lyd.audio.stop("ambiance")
  elseif key == "a" then
    lyd.audio.play("ambiance", {volumeDb = -12})
  end
end

function love.draw()
  love.graphics.print("Space: jump   S: stop ambiance   A: restart ambiance", 20, 30)
end
