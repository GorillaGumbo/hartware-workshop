local x, y

function love.load()
  love.math.setRandomSeed(7)
  print("Seeded roll:", love.math.random(1, 100))
  x = love.math.random(80, 720)
  y = love.math.random(80, 520)
end

function love.draw()
  love.graphics.setColor(0.6, 0.8, 0.3)
  love.graphics.circle("fill", x, y, 24)
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("love.math.random", 20, 20)
end
