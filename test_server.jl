using HTTP.WebSockets, JSON3

const IP_ADDRESS = "127.0.0.1"
const PORT = 8000

connected_clients = WebSocket[]

function start_server()
    server = WebSockets.listen!(IP_ADDRESS, PORT) do ws 
        push!(connected_clients, ws)
        num_clients = length(connected_clients)
        @info "New Connection: $num_clients"
        for msg in ws
            @info "Received message: $msg from client"
            reply = "Hello from Julia"
            try
                send(ws, reply)
            catch e
                @error "Failed to send message: $e"
            end
        end
    end
    return server
end

#start_server
server = start_server()

#data for testing

# Initial data
data = Dict(
    "type" => "update",
    "timestamp" => time(),
    "field" => "name",
    "value" => "Julia"
)
data = Dict(
    "type" => "update",
    "timestamp" => time(),
    "field" => "age",
    "value" => "21"
)
data = Dict(
    "type" => "update",
    "timestamp" => time(),
    "field" => "res",
    "value" => Dict("max"=>rand(100),"rms"=>rand(100))
)

#test function
for (i,client) in enumerate(connected_clients)
    try
        #update data
        data["timestamp"] = time()
        send(client, JSON3.write(data))
    catch e
        @error "Failed to send message to $i: $e"
        popat!(connected_clients, i)
    end
end
# JSON3.write(data)