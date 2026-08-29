using GameTimeGuard.Agent;
using GameTimeGuard.Agent.Services;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "GameTimeGuardAgent";
});

builder.Services.AddSingleton<ProcessGuard>();
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
