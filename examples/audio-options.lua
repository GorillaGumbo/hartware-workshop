-- Create Event jump, load a real Sound, then Run and click Game.
-- Space triggers once per press. Values override only this playback.
function love.keypressed(key)
  if key == "space" then
    lyd.audio.play("jump", {
      volumeDb = -6,
      fadeIn = false,
      fadeOut = { speed = "fast", curve = "smooth" }
    })
  end
end

function love.draw()
  love.graphics.print("Space: jump at -6 dB, no fade-in", 24, 24)
end
