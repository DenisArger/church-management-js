const testWebhook = async () => {
  const testData = {
    update_id: 1,
    message: {
      message_id: 1,
      from: {
        id: 123456789,
        first_name: "Test",
        username: "testuser",
      },
      chat: {
        id: 123456789,
        type: "private",
      },
      text: "/help",
      date: 1234567890,
    },
  };

  try {
    const response = await fetch("http://localhost:3000/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();
    console.log("Webhook test result:", result);
  } catch (error) {
    console.error("Webhook test error:", error);
  }
};

testWebhook();
